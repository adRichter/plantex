#version 140

in vec4 shadowCoord;
in vec3 x_material_color;
in vec3 surfaceNormal;

in vec3 x_position;

in float x_radius;
in vec2 x_tex_coords;



out vec3 color;

// Vector from the camera to the sun
uniform vec3 sun_dir;
// FIXME This should be a `sampler2DShadow`, but glium doesn't expose it
uniform sampler2D shadow_map;

uniform sampler2D my_texture;
uniform sampler2D normals;

// Percentage-closer filtering (square) radius in pixels
const int SHADOW_PCF_RADIUS = 1;

const vec3 sun = normalize(vec3(1.0, 0.0, 1.0));
const float SHADOW_BIAS = 0.00001;    // FIXME does this even work?
const float AMBIENT = 0.2;

mat3 cotangent_frame(vec3 normal, vec3 pos, vec2 uv) {
    vec3 dp1 = dFdx(pos);
    vec3 dp2 = dFdy(pos);
    vec2 duv1 = dFdx(uv);
    vec2 duv2 = dFdy(uv);

    vec3 dp2perp = cross(dp2, normal);
    vec3 dp1perp = cross(normal, dp1);
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    float invmax = inversesqrt(max(dot(T, T), dot(B, B)));
    return mat3(T * invmax, B * invmax, normal);
}

void main() {
    // Shadow map height/width in pixels:
    float SHADOW_MAP_SIZE = textureSize(shadow_map, 0).x;

    vec3 lightCoords = shadowCoord.xyz / shadowCoord.w;
    lightCoords = lightCoords * 0.5 + 0.5;
    float pixelOffset = 1.0 / SHADOW_MAP_SIZE;
    float shadowFactor = 0.0;

    for (int y = -SHADOW_PCF_RADIUS; y <= SHADOW_PCF_RADIUS; y++) {
        for (int x = -SHADOW_PCF_RADIUS; x <= SHADOW_PCF_RADIUS; x++) {
            vec2 offset = vec2(x * pixelOffset, y * pixelOffset);
            vec2 mapCoords = lightCoords.xy + offset;
            if (mapCoords.x > 1.0 || mapCoords.x < 0 || mapCoords.y > 1 || mapCoords.y < 0) {
                // Guess the shadow depending on the sun angle
                float sunVertDot = 0.5 + dot(sun_dir, vec3(0, 0, 1)) * 0.5;
                shadowFactor += sunVertDot * 0.8;
            } else {
                bool shadow = texture(shadow_map, mapCoords).r
                    < lightCoords.z + SHADOW_BIAS;
                shadowFactor += shadow ? 1.0 : 0.0;
            }
        }
    }

    // Height/Width of the square we sample for Percentage Closer Filtering
    // (in Pixels)
    const int PCF_PIXELS = 1 + 2 * SHADOW_PCF_RADIUS;

    // Divide by number of pixels we sampled, to get  a range from 0 to 1
    shadowFactor /= PCF_PIXELS * PCF_PIXELS;


    // Calculate normal map relative to surface
    vec3 normal_map = texture(normals, x_tex_coords).rgb;

    // Calculate Tangent Binormal Normal (tbn) Matrix to multiply with normal_map
    // to convert to real normals
    mat3 tbn = cotangent_frame(surfaceNormal, x_position, x_tex_coords);
    vec3 real_normal = normalize(tbn * -(normal_map * 2.0 - 1.0));


    // Do the normal light calculation. Ambient light is not affected by shadow,
    // other lights are coming from the sun so they're affected.

    // Calculate diffuse light
    float diffuse = max(0.0, dot(-sun_dir, real_normal));

    // Calculate diffuse color
    vec3 diffuse_color = texture(my_texture, x_tex_coords).rgb;


    // for showing normal map as texture
    // vec3 normal_color_map = texture(normals, x_tex_coords).rgb;


    const vec3 specular_color = vec3(1.0, 1.0, 1.0);
    vec3 camera_dir = normalize(-x_position);
    vec3 half_direction = normalize(normalize(-sun_dir) + camera_dir);
    float specular = pow(max(dot(half_direction, real_normal), 0.0), 16.0);

    // Final color calculation
    // color = x_material_color * AMBIENT + x_material_color * diffuse * (1.0 - shadowFactor);
    color = x_material_color * AMBIENT + diffuse_color * diffuse + specular_color * specular;
    // color = x_material_color * ambient + x_material_color * diffuse * (1.0 - shadowFactor);

    // Set Border
    if (x_radius > 0.98) {
        color *= 0.3;
    }

}
