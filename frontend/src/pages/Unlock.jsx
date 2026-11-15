import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_URL, apiFetch } from "../utils/api";
import ShaderBackground from "../components/ShaderBackground";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

const Unlock = () => {
  const { code } = useParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError("");

    try {
      const res = await apiFetch(`${API_URL}/api/unlock/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (res.ok && data.longUrl) {
        // Guard against javascript: pseudo-protocol XSS
        if (/^https?:\/\//i.test(data.longUrl) || /^[a-z][a-z0-9+.-]*:\/\//i.test(data.longUrl)) {
          window.location.href = data.longUrl;
        } else {
          setError("Invalid redirect destination URL");
        }
      } else {
        setError(data.message || "Incorrect password");
      }
    } catch (err) {
      console.error("Unlock error:", err);
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ShaderBackground />
      <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4 border border-border-glass">
              <span className="material-symbols-outlined text-[32px] text-tertiary">lock</span>
            </div>
            <h1 className="font-display-lg text-headline-md text-on-surface mb-2">Protected Link</h1>
            <p className="text-text-muted font-body-sm">This link requires a password to access.</p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-6">
            <Input
              type="password"
              label="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon="key"
              required
            />
            
            {error && (
              <p className="text-error text-label-sm font-label-sm text-center">{error}</p>
            )}

            <Button 
              type="submit" 
              variant="gradient" 
              className="w-full"
              loading={loading}
              icon="lock_open"
            >
              Unlock Link
            </Button>
          </form>

          <div className="mt-8 text-center">
            <button onClick={() => navigate('/')} className="text-label-sm font-label-sm text-text-muted hover:text-on-surface transition-colors underline">
              Return to Home
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Unlock;
