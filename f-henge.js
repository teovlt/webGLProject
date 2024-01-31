// Animer
'use strict'

import * as math from 'mathjs'
import { ndc, perspective, translation, yRotation, zRotation, xRotation } from '/matrices'

//====================================
// Récupération canvas + WebGL
//====================================
const canvas = document.querySelector('canvas')

const gl = canvas.getContext('webgl2')
if (!gl) {
  throw new Error('No WebGL for you!')
}

//====================================
// Création et Association des shaders
//====================================
const vertex_GLSL = `#version 300 es
in vec3 a_position;
in vec3 a_color;
uniform mat4 u_projectionMatrix;
uniform mat4 u_modelViewMatrix;

out vec4 v_color;

void main() {
  gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(a_position,1);

  v_color = vec4(a_color,1);
}
`

const fragment_GLSL = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
   outColor = v_color;
}
`

const prg = creation_programme_shading(gl, [
  [gl.VERTEX_SHADER, vertex_GLSL],
  [gl.FRAGMENT_SHADER, fragment_GLSL],
])

// Localisation des attributs
const positionLocation = gl.getAttribLocation(prg, 'a_position')
const colorLocation = gl.getAttribLocation(prg, 'a_color')
// Localisation des uniforms
const projectionMatrixLocation = gl.getUniformLocation(prg, 'u_projectionMatrix')
const modelViewMatrixLocation = gl.getUniformLocation(prg, 'u_modelViewMatrix')

//====================================
// Création des buffers
//====================================
// Construire un VAO spécifique
const vao = gl.createVertexArray()
gl.bindVertexArray(vao)

const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(getCubeGeometry()), gl.STATIC_DRAW)
gl.enableVertexAttribArray(positionLocation)
gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)

// For ground geometry
// gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(getGroundGeometry()), gl.STATIC_DRAW)
// gl.enableVertexAttribArray(positionLocation)
// gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)

const colorBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
setColors(gl)
gl.enableVertexAttribArray(colorLocation)
gl.vertexAttribPointer(colorLocation, 2, gl.UNSIGNED_BYTE, true, 2, 2)

//====================================
// Dessin de l'image
//====================================

// Spécifier le programme utilisé (i.e. les shaders utilisés)
gl.useProgram(prg)

// Données constantes pour toutes les images de l'animation

// La matrice de projection définie comme produit
// de la matrice de conversion ndc et la matrice de perspective.
// fov et zNear sont donnés, ce qui impose h, puis w pour respecter
//  les proportions de l'image affichée.
// zfar est à choisir pour inclure les objets à rendre.
const fieldOfViewInRadians = degToRad(60)
const zNear = 3 //1
const zFar = 1000 //2000;
const h = zNear * Math.tan(0.5 * fieldOfViewInRadians)
const w = (h * canvas.clientWidth) / canvas.clientHeight
//const aspect = canvas.clientWidth / canvas.clientHeight;
//const projectionMatrix = projection(fieldOfViewInRadians, aspect, zNear, zFar);
const projectionMatrix = math.multiply(ndc(w, h, zNear, zFar), perspective(zNear, zFar))
// In GLSL matrices are transposed!!!
gl.uniformMatrix4fv(projectionMatrixLocation, false, math.flatten(math.transpose(projectionMatrix)).valueOf())

// La matrice de vue de la scène
//  - positionner la caméra : définir une position initiale avant animation
//    vecteur UP
//const cameraUP = degToRad(-40);
const cameraUP = degToRad(0)
let cameraMatrix = zRotation(cameraUP)
//    visée : position+orientation
const radius = 300 // la position de la caméra dépend du rayon du F-henge
const cameraAngleRadians = degToRad(-3)
let cameraMatrixInit = translation(0, 0, radius * 2.0)
cameraMatrixInit = math.multiply(xRotation(cameraAngleRadians), cameraMatrixInit)

// Paramètres variants de l'animation : position de la caméra
let pos = -1
let cameraPosRadians

drawScene()

function drawScene() {
  // Réinitialiser le viewport
  // Le fragment shader dessine les pixels du viewport.
  // Le viewport définit normalement un sous-ensemble (et non un sur-ensemble) du canvas.
  // Le css vient ensuite déformer le canvas aux dimensions de la fenêtre.
  // Si pour la caméra, ce sont les dimensions de la fenêtre (cliente) qu'il faut récupérer
  // pour compenser la future déformation,
  // pour le viewport, ce sont les dimensions du canvas (avant déformation par le css).
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0.5, 0.7, 1.0, 1.0) // couleur du canvas et non du viewport
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.CULL_FACE)
  gl.enable(gl.DEPTH_TEST)

  // Activer le VAO à utiliser pour lire les valeurs d'attributs
  gl.bindVertexArray(vao)

  // Mise à jour des uniforms (et attributes)
  pos = pos + 1
  cameraPosRadians = degToRad(pos)
  cameraMatrix = math.multiply(yRotation(cameraPosRadians), cameraMatrixInit)

  //  - en déduire la matrice de vue pour un objet centrée dans la scène
  const inversedCameraMatrixWorld = math.inv(cameraMatrix)

  // Les objets sont numFs copies d'un F sur le cercle de rayon radius
  // const numFs = 2
  // for (let ii = 0; ii < numFs; ++ii) {
  //   // - définir la matrice de positionnement de l'objet dans la scène
  //   const angle = ii * Math.PI * 2 / numFs;
  //   const x = Math.cos(angle) * radius;
  //   const y = Math.sin(angle) * radius;
  // let objectMatrixWorld = translation(x, 0, -y);
  // objectMatrixWorld = math.multiply(objectMatrixWorld,yRotation(-0.5*Math.PI+angle));
  let objectMatrixWorld = math.identity(4)
  //  - en déduire la matrice de vue de la scène
  const modelViewMatrix = math.multiply(inversedCameraMatrixWorld, objectMatrixWorld)
  // In GLSL matrices are transposed!!!
  gl.uniformMatrix4fv(modelViewMatrixLocation, false, math.flatten(math.transpose(modelViewMatrix)).valueOf())

  const primitiveType = gl.TRIANGLES
  const offset = 0
  const count = 111111 // 16 tuiles de 2 triangles avec 3 vertices chacun
  gl.drawArrays(primitiveType, offset, count)
  // }

  requestAnimationFrame(drawScene)
}

//=========================================================
// Library: to fill buffers with data (geometry or colours)
//=========================================================
function setColors(gl) {
  let myColors = []
  let cIdx = 16
  // 3 tuiles de 2 triangles pour la face avant
  for (let ii = 0; ii < 9; ii++) myColors = myColors.concat([ui8Colors[cIdx], ui8Colors[cIdx + 1], ui8Colors[cIdx + 2]])

  // 3 tuiles de 2 triangles pour la face arrière
  cIdx += 4
  for (let ii = 0; ii < 18; ii++) myColors = myColors.concat([ui8Colors[cIdx], ui8Colors[cIdx + 1], ui8Colors[cIdx + 2]])

  // 1 tuile de 2 triangles pour les 10 autres faces
  for (let f = 0; f < 10; f++) {
    cIdx += 4
    for (let ii = 0; ii < 5; ii++) myColors = myColors.concat([ui8Colors[cIdx], ui8Colors[cIdx + 1], ui8Colors[cIdx + 2]])
  }

  gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(myColors), gl.STATIC_DRAW)
}
