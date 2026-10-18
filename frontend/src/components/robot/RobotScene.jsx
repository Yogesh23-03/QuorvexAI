import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const STATE_COLOR = {
  idle: "#38bdf8",
  thinking: "#ff6a2b",
  success: "#a3e635",
  error: "#f43f5e",
};

function Eye({ x, color, pupil, blinkRef }) {
  // Sits on the outer face of the visor (z = 0.70) so the lens is never hidden
  // behind the opaque panel.
  return (
    <group position={[x, 0.03, 0.7]}>
      <mesh scale={[0.19, 0.23, 0.08]} ref={blinkRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.6}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.02, 0.07]} scale={[0.06, 0.08, 0.03]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0, -0.06]} scale={0.11}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color={pupil} />
      </mesh>
    </group>
  );
}

function RobotModel({ state = "idle", isDark = true }) {
  const groupRef = useRef(null);
  const headRef = useRef(null);
  const ringRef = useRef(null);
  const antennaRef = useRef(null);
  const blinkLeft = useRef(null);
  const blinkRight = useRef(null);
  const blinkAt = useRef(1.8);

  const accent = STATE_COLOR[state] || STATE_COLOR.idle;
  const shell = isDark ? "#2c3342" : "#dbe3ee";
  const shellEdge = isDark ? "#1c2230" : "#b7c2d2";
  const joint = isDark ? "#3a4354" : "#9aa8bc";
  const visor = isDark ? "#0a0e15" : "#111827";

  const mats = useMemo(
    () => ({
      shell: new THREE.MeshStandardMaterial({ color: shell, metalness: 0.55, roughness: 0.38 }),
      edge: new THREE.MeshStandardMaterial({ color: shellEdge, metalness: 0.7, roughness: 0.32 }),
      joint: new THREE.MeshStandardMaterial({ color: joint, metalness: 0.8, roughness: 0.28 }),
      visor: new THREE.MeshStandardMaterial({ color: visor, metalness: 0.4, roughness: 0.15 }),
    }),
    [shell, shellEdge, joint, visor],
  );

  useFrame((studio, delta) => {
    const t = studio.clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.9) * 0.06;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        studio.pointer.x * 0.45,
        0.06,
      );
    }
    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.lerp(
        headRef.current.rotation.y,
        studio.pointer.x * 0.35,
        0.08,
      );
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        -studio.pointer.y * 0.22,
        0.08,
      );
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (state === "thinking" ? 1.6 : 0.25);
      ringRef.current.rotation.x = Math.PI / 2.4;
    }
    if (antennaRef.current) {
      const pulse = state === "thinking" ? 0.6 + Math.abs(Math.sin(t * 4)) * 1.8 : 1;
      antennaRef.current.material.emissiveIntensity = pulse;
    }

    if (blinkAt.current < t) blinkAt.current = t + 3.2 + Math.random() * 3;

    const blinking = blinkAt.current - t < 0.14;
    [blinkLeft, blinkRight].forEach((ref) => {
      if (!ref.current) return;
      const target = blinking ? 0.12 : 1;
      ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, 0.23 * target, 0.35);
    });
  });

  return (
    <group ref={groupRef} position={[0, 0.1, 0]}>
      {/* torso */}
      <group position={[0, -1.15, 0]}>
        <RoundedBox args={[1.75, 1.2, 0.95]} radius={0.28} smoothness={4} material={mats.shell} />
        <RoundedBox
          args={[1.15, 0.5, 0.12]}
          radius={0.12}
          smoothness={4}
          position={[0, 0.15, 0.5]}
          material={mats.visor}
        />
        <mesh position={[0, 0.15, 0.57]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.035, 16, 32]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[-0.95, -0.1, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.joint}>
          <capsuleGeometry args={[0.2, 0.34, 8, 16]} />
        </mesh>
        <mesh position={[0.95, -0.1, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.joint}>
          <capsuleGeometry args={[0.2, 0.34, 8, 16]} />
        </mesh>
      </group>

      {/* segmented neck */}
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[0, -0.52 - index * 0.11, 0]} material={mats.joint}>
          <cylinderGeometry args={[0.24 - index * 0.02, 0.24 - index * 0.02, 0.1, 24]} />
        </mesh>
      ))}

      {/* head */}
      <group ref={headRef} position={[0, 0.35, 0]}>
        <RoundedBox args={[2.25, 1.6, 1.25]} radius={0.42} smoothness={5} material={mats.shell} />
        {/* visor */}
        <RoundedBox
          args={[1.72, 0.72, 0.16]}
          radius={0.26}
          smoothness={4}
          position={[0, 0.03, 0.62]}
          material={mats.visor}
        />
        <Eye x={-0.42} color={accent} pupil={visor} blinkRef={blinkLeft} />
        <Eye x={0.42} color={accent} pupil={visor} blinkRef={blinkRight} />

        {/* cheek vents */}
        {[-1, 1].map((side) =>
          [0, 1, 2].map((index) => (
            <mesh
              key={`${side}-${index}`}
              position={[side * 0.78, -0.42 - index * 0.07, 0.58]}
              material={mats.edge}
            >
              <boxGeometry args={[0.26, 0.035, 0.05]} />
            </mesh>
          )),
        )}

        {/* ears */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 1.16, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={mats.joint}>
              <cylinderGeometry args={[0.27, 0.27, 0.16, 24]} />
            </mesh>
            <mesh position={[side * 0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.17, 0.17, 0.04, 24]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={1.2}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}

        {/* antenna */}
        <mesh position={[0, 0.86, 0]} material={mats.edge}>
          <cylinderGeometry args={[0.035, 0.035, 0.36, 12]} />
        </mesh>
        <mesh ref={antennaRef} position={[0, 1.1, 0]}>
          <sphereGeometry args={[0.1, 20, 20]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>

        {/* thinking halo */}
        {state === "thinking" && (
          <mesh ref={ringRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
            <torusGeometry args={[1.55, 0.018, 12, 96]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        )}
      </group>

      {/* floating cog shoulders */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.35, -0.85, -0.15]} rotation={[0.9, 0.4, side * 0.2]}>
          <mesh material={mats.edge}>
            <torusGeometry args={[0.22, 0.07, 10, 24]} />
          </mesh>
          <mesh material={mats.joint}>
            <cylinderGeometry args={[0.09, 0.09, 0.12, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Quor is about 3.6 units tall and 3.2 wide, so the camera has to back off
 * according to the container's aspect ratio. Without this the model is cropped
 * inside whatever box the caller happens to give it.
 */
function FitCamera({ radius = 2.15, centerY = -0.1 }) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useEffect(() => {
    const verticalFov = (camera.fov * Math.PI) / 180;
    const aspect = Math.max(width / Math.max(height, 1), 0.2);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const distance = Math.max(
      radius / Math.tan(verticalFov / 2),
      radius / Math.tan(horizontalFov / 2),
    );

    camera.position.set(0, centerY, distance);
    camera.lookAt(0, centerY, 0);
    camera.updateProjectionMatrix();
  }, [camera, radius, centerY, width, height]);

  return null;
}

export default function RobotScene({
  state = "idle",
  isDark = true,
  className,
  size = 160,
  fill = false,
}) {
  const box = fill ? { width: "100%", height: "100%" } : { width: size, height: size };

  return (
    <div className={className} style={box}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 40, position: [0, -0.1, 6.2] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <FitCamera />
        <ambientLight intensity={isDark ? 0.55 : 0.9} />
        <directionalLight position={[3, 5, 4]} intensity={isDark ? 1.6 : 2.2} color="#ffffff" />
        <pointLight position={[-4, 1, 3]} intensity={isDark ? 26 : 16} color="#ff6a2b" />
        <pointLight position={[4, -1, 2]} intensity={isDark ? 18 : 12} color="#38bdf8" />
        <Float speed={1.3} rotationIntensity={0.12} floatIntensity={0.35}>
          <RobotModel state={state} isDark={isDark} />
        </Float>
      </Canvas>
    </div>
  );
}
