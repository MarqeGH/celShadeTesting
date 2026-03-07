export const celFragmentShader = /* glsl */ `
uniform vec3 uBaseColor;
uniform vec3 uLightDirection;
uniform vec3 uAmbientColor;
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uLightDirection);

  float NdotL = dot(normal, lightDir);

  // 4-step toon ramp with hard edges
  float intensity;
  if (NdotL > 0.6) {
    intensity = 1.1;  // highlight
  } else if (NdotL > 0.2) {
    intensity = 0.85; // light
  } else if (NdotL > -0.1) {
    intensity = 0.6;  // mid
  } else {
    intensity = 0.35; // shadow
  }

  vec3 color = uBaseColor * intensity + uAmbientColor;
  gl_FragColor = vec4(color, uOpacity);
}
`;
