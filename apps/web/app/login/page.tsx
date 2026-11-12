"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { useAuth } from "../auth-provider";
import { apiClient } from "../../lib/api/client";

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { isConfigured, isLoading, isLocalDevelopment, user, signIn, signUp, signInWithGoogle } = useAuth();

  async function routePostAuth() {
    try {
      const envs = await apiClient.environments.list();
      if (!envs || envs.length === 0) {
        window.location.assign("/onboarding");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      window.location.assign("/onboarding");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (user || (isLocalDevelopment && !params.has("preview"))) {
      void routePostAuth();
    }
  }, [isLocalDevelopment, user]);

  useEffect(() => {
    let active = true;
    let renderer: any;
    let geometry: any;
    let material: any;
    let scene: any;
    let camera: any;
    let animationId: number;
    let cleanUpResize: (() => void) | undefined;

    const initThree = (THREE: any) => {
      if (!canvasRef.current || !active) return;
      const canvas = canvasRef.current;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const uniforms = {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth * 2, window.innerHeight * 2) },
        u_opacities: { value: [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0] },
        u_colors: {
          value: [
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
          ],
        },
        u_total_size: { value: 20.0 },
        u_dot_size: { value: 6.0 },
        u_reverse: { value: 0 },
      };

      material = new THREE.ShaderMaterial({
        vertexShader: `
          precision mediump float;
          uniform vec2 u_resolution;
          out vec2 fragCoord;
          void main() {
            gl_Position = vec4(position, 1.0);
            fragCoord = (position.xy + 1.0) * 0.5 * u_resolution;
            fragCoord.y = u_resolution.y - fragCoord.y;
          }
        `,
        fragmentShader: `
          precision mediump float;
          in vec2 fragCoord;

          uniform float u_time;
          uniform float u_opacities[10];
          uniform vec3 u_colors[6];
          uniform float u_total_size;
          uniform float u_dot_size;
          uniform vec2 u_resolution;
          uniform int u_reverse;

          out vec4 fragColor;

          float PHI = 1.61803398874989484820459;
          float random(vec2 xy) {
              return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
          }

          void main() {
              vec2 st = fragCoord.xy;
              st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
              st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

              float opacity = step(0.0, st.x) * step(0.0, st.y);

              vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

              float frequency = 5.0;
              float show_offset = random(st2);
              float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
              opacity *= u_opacities[int(rand * 10.0)];
              opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
              opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

              vec3 color = u_colors[int(show_offset * 6.0)];

              float animation_speed_factor = 3.0;
              vec2 center_grid = u_resolution / 2.0 / u_total_size;
              float dist_from_center = distance(center_grid, st2);

              float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);

              float current_timing_offset = timing_offset_intro;
              opacity *= step(current_timing_offset, u_time * animation_speed_factor);
              opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);

              fragColor = vec4(color, opacity);
              fragColor.rgb *= fragColor.a;
          }
        `,
        uniforms: uniforms,
        glslVersion: THREE.GLSL3,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
        transparent: true,
      });

      geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const startTime = performance.now();
      const animate = () => {
        if (!active) return;
        animationId = requestAnimationFrame(animate);
        uniforms.u_time.value = (performance.now() - startTime) / 1000.0;
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        uniforms.u_resolution.value.set(window.innerWidth * 2, window.innerHeight * 2);
      };
      window.addEventListener("resize", handleResize);

      cleanUpResize = () => {
        window.removeEventListener("resize", handleResize);
      };
    };

    if ((window as any).THREE) {
      initThree((window as any).THREE);
    } else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.async = true;
      script.onload = () => {
        if ((window as any).THREE && active) {
          initThree((window as any).THREE);
        }
      };
      document.head.appendChild(script);
    }

    return () => {
      active = false;
      if (cleanUpResize) cleanUpResize();
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) renderer.dispose();
      if (geometry) geometry.dispose();
      if (material) material.dispose();
    };
  }, []);

  async function handleEmailAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      if (isLogin) {
        await signIn(email, password);
        await routePostAuth();
      } else {
        const result = await signUp(email, password);
        setMessage(
          result.confirmationRequired
            ? "Check your email to confirm your account, then sign in."
            : "Account created. Opening your environment…",
        );
        if (!result.confirmationRequired) {
          await routePostAuth();
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to authenticate.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleAuth() {
    setSubmitting(true);
    setMessage("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in with Google.");
      setSubmitting(false);
    }
  }

  /* ─── Shared button styles ─── */
  const socialBtn: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem",
    borderRadius: 6,
    border: "1px solid #333",
    background: "#18181b",
    color: "#fff",
    fontWeight: 500,
    fontSize: "0.875rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    marginBottom: "0.45rem",
    transition: "background 0.15s ease, border-color 0.15s ease",
  };

  const disabledSocialBtn: React.CSSProperties = {
    ...socialBtn,
    opacity: 0.38,
    cursor: "not-allowed",
    background: "#0c0c0e",
    border: "1px solid #222",
    color: "#71717a",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.85rem",
    borderRadius: 6,
    border: "1px solid #333",
    background: "#000",
    color: "#fff",
    fontSize: "0.875rem",
    outline: "none",
  };

  /* ─── Icons ─── */
  const GoogleIcon = (
    <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );

  const GitHubIcon = (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );

  const AppleIcon = (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.79 3.59-.76 1.56.04 2.88.75 3.65 1.89-3.08 1.75-2.58 5.61.35 6.75-1.01 2.37-2.39 4.39-4.29 4.29zM12.03 7.25c-.15-2.23 1.66-4.07 3.72-4.25.36 2.38-1.92 4.34-3.72 4.25z" />
    </svg>
  );

  const Logo = (
    <Link
      href="/"
      style={{
        background: "#111",
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        marginBottom: "0.75rem",
        border: "1px solid #333",
        color: "#fff",
        textDecoration: "none",
      }}
      title="PayGuardian Home"
    >
      <Shield style={{ width: 20, height: 20 }} />
    </Link>
  );

  const Footer = (
    <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#666", lineHeight: 1.5, textAlign: "center" }}>
      By proceeding, you agree to PayGuardian's{" "}
      <Link href="/terms" style={{ color: "#888", textDecoration: "underline" }}>
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="/privacy" style={{ color: "#888", textDecoration: "underline" }}>
        Privacy Policy
      </Link>
      .
      <div style={{ marginTop: "0.5rem" }}>
        <Link href="/" style={{ color: "#888", textDecoration: "none" }}>
          ← Back to home
        </Link>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#000",
        color: "#fff",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* WebGL Dot canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "radial-gradient(circle at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.92) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Modal card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "#121212",
          borderRadius: 12,
          padding: "2rem",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 10px 40px rgba(0,0,0,0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: "1px solid #222",
        }}
      >
        {isLogin ? (
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {Logo}
            <h1
              style={{
                fontSize: "1.35rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
                letterSpacing: "-0.025em",
              }}
            >
              Sign in to PayGuardian
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.85rem", lineHeight: 1.5 }}>
              Manage autonomous environments, agent authority, and payment activity.
            </p>

            <form
              onSubmit={handleEmailAuth}
              style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.65rem" }}
            >
              <input
                style={input}
                type="email"
                placeholder="name@work-email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                style={input}
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="submit"
                disabled={submitting || isLoading}
                style={{
                  width: "100%",
                  padding: "0.65rem",
                  borderRadius: 6,
                  border: "none",
                  background: submitting ? "#777" : "#ededed",
                  color: "#000",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  cursor: submitting ? "wait" : "pointer",
                }}
              >
                {submitting ? "Signing in…" : "Continue with Email"}
              </button>
            </form>

            <div style={{ height: 1, background: "#222", width: "100%", margin: "0.85rem 0" }} />

            {/* Social Buttons */}
            <button
              type="button"
              style={socialBtn}
              disabled={submitting || isLoading}
              onClick={handleGoogleAuth}
            >
              {GoogleIcon}
              <span>Continue with Google</span>
            </button>

            {/* GitHub - Disabled */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              style={disabledSocialBtn}
              title="GitHub sign in coming soon"
            >
              {GitHubIcon}
              <span>Continue with GitHub</span>
              <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#555" }}>
                Disabled
              </span>
            </button>

            {/* Apple - Disabled */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              style={{ ...disabledSocialBtn, marginBottom: 0 }}
              title="Apple sign in coming soon"
            >
              {AppleIcon}
              <span>Continue with Apple</span>
              <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#555" }}>
                Disabled
              </span>
            </button>

            {message && (
              <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#f87171" }} role="status">
                {message}
              </p>
            )}

            <div style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#888" }}>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  setMessage("");
                }}
                style={{
                  color: "#fff",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                }}
              >
                Sign Up
              </button>
            </div>
            {Footer}
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {Logo}
            <h1
              style={{
                fontSize: "1.35rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
                letterSpacing: "-0.025em",
              }}
            >
              Sign up for PayGuardian
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.85rem", lineHeight: 1.5 }}>
              Create a new account to govern autonomous multi-agent payments.
            </p>

            <form
              onSubmit={handleEmailAuth}
              style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.65rem" }}
            >
              <input
                style={input}
                type="text"
                placeholder="Full Name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <input
                style={input}
                type="email"
                placeholder="name@work-email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                style={input}
                type="password"
                placeholder="Password (min 6 chars)"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="submit"
                disabled={submitting || isLoading}
                style={{
                  width: "100%",
                  padding: "0.65rem",
                  borderRadius: 6,
                  border: "none",
                  background: submitting ? "#777" : "#ededed",
                  color: "#000",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  cursor: submitting ? "wait" : "pointer",
                }}
              >
                {submitting ? "Creating account…" : "Sign Up with Email"}
              </button>
            </form>

            <div style={{ height: 1, background: "#222", width: "100%", margin: "0.85rem 0" }} />

            {/* Social Buttons */}
            <button
              type="button"
              style={socialBtn}
              disabled={submitting || isLoading}
              onClick={handleGoogleAuth}
            >
              {GoogleIcon}
              <span>Sign up with Google</span>
            </button>

            {/* GitHub - Disabled */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              style={disabledSocialBtn}
              title="GitHub sign up coming soon"
            >
              {GitHubIcon}
              <span>Sign up with GitHub</span>
              <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#555" }}>
                Disabled
              </span>
            </button>

            {/* Apple - Disabled */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              style={{ ...disabledSocialBtn, marginBottom: 0 }}
              title="Apple sign up coming soon"
            >
              {AppleIcon}
              <span>Sign up with Apple</span>
              <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#555" }}>
                Disabled
              </span>
            </button>

            {message && (
              <p
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.78rem",
                  color: message.includes("Check your email") ? "#4ade80" : "#f87171",
                }}
                role="status"
              >
                {message}
              </p>
            )}

            <div style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#888" }}>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setMessage("");
                }}
                style={{
                  color: "#fff",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                }}
              >
                Sign In
              </button>
            </div>
            {Footer}
          </div>
        )}
      </div>
    </div>
  );
}
