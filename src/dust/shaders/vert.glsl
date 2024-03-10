precision mediump float;

attribute vec2 aPosition;
attribute vec2 aTexCoord;

uniform mat3 uModelViewProjectionMatrix;

varying vec3 vColor;
varying vec2 vTexCoord;

void main() {
    gl_Position = vec4(uModelViewProjectionMatrix * vec3(aPosition, 1.0), 1.0);
    vTexCoord = aTexCoord;
}
