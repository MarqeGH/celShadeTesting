export const outlineFragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 uResolution;
uniform float uOutlineWidth;
uniform float uDepthThreshold;
uniform float uNormalThreshold;
uniform float cameraNear;
uniform float cameraFar;

varying vec2 vUv;

float linearizeDepth(float d) {
  return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
}

void main() {
  vec4 sceneColor = texture2D(tDiffuse, vUv);

  vec2 texelSize = uOutlineWidth / uResolution;

  // Sample depth at 4 neighbors
  float dc = linearizeDepth(texture2D(tDepth, vUv).r);
  float dl = linearizeDepth(texture2D(tDepth, vUv + vec2(-texelSize.x, 0.0)).r);
  float dr = linearizeDepth(texture2D(tDepth, vUv + vec2( texelSize.x, 0.0)).r);
  float dt = linearizeDepth(texture2D(tDepth, vUv + vec2(0.0,  texelSize.y)).r);
  float db = linearizeDepth(texture2D(tDepth, vUv + vec2(0.0, -texelSize.y)).r);

  // Sobel-like depth edge detection
  float depthEdge = abs(dl - dc) + abs(dr - dc) + abs(dt - dc) + abs(db - dc);
  // Normalize by center depth to handle near/far objects consistently
  depthEdge = depthEdge / (dc + 0.001);

  // Sample normals at 4 neighbors
  vec3 nc = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
  vec3 nl = texture2D(tNormal, vUv + vec2(-texelSize.x, 0.0)).rgb * 2.0 - 1.0;
  vec3 nr = texture2D(tNormal, vUv + vec2( texelSize.x, 0.0)).rgb * 2.0 - 1.0;
  vec3 nt = texture2D(tNormal, vUv + vec2(0.0,  texelSize.y)).rgb * 2.0 - 1.0;
  vec3 nb = texture2D(tNormal, vUv + vec2(0.0, -texelSize.y)).rgb * 2.0 - 1.0;

  // Normal edge detection via dot product difference
  float normalEdge = 0.0;
  normalEdge += 1.0 - dot(nc, nl);
  normalEdge += 1.0 - dot(nc, nr);
  normalEdge += 1.0 - dot(nc, nt);
  normalEdge += 1.0 - dot(nc, nb);

  float isDepthEdge = step(uDepthThreshold, depthEdge);
  float isNormalEdge = step(uNormalThreshold, normalEdge);
  float edge = max(isDepthEdge, isNormalEdge);

  // Black outline where edge is detected
  vec3 finalColor = mix(sceneColor.rgb, vec3(0.0), edge);
  gl_FragColor = vec4(finalColor, 1.0);
}
`;
