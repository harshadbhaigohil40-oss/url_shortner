import { useState, useContext, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { AuthContext } from "../context/AuthContext";
import { apiFetch, API_URL } from "../utils/api";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showSsoModal, setShowSsoModal] = useState(false);
  const { user, login, logout } = useContext(AuthContext);

  useEffect(() => {
    let strength = 0;
    if (password.length > 5) strength += 1;
    if (password.length > 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    setPasswordStrength(Math.min(4, Math.max(1, strength)));
  }, [password]);

  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "bg-error", "bg-amber-500", "bg-emerald-400", "bg-emerald-500"];

  const navigate = useNavigate();
  const canvasRef = useRef(null);

  useEffect(() => {
    // Floating particle effect (Canvas background)
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let particles = [];
    const particleCount = 40;
    let animationFrameId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    class Particle {
      constructor() {
        this.init();
      }
      init() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.5 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.alpha = Math.random() * 0.5;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }
      draw() {
        ctx.fillStyle = `rgba(173, 198, 255, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) particles.push(new Particle());

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const res = await apiFetch(`${API_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: tokenResponse.access_token }),
        }, user, login, logout);

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.message || "Google authentication failed");
        }

        login(data);
        navigate("/dashboard");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google Login Failed:', error);
      setError("Google Login failed");
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }, user, login, logout);

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setSuccess("Account created! Logging in...");
      
      // Auto login
      const loginRes = await apiFetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }, user, login, logout);
      
      if (loginRes.ok) {
        const loginData = await loginRes.json();
        login(loginData);
        setTimeout(() => navigate("/dashboard"), 1000);
      } else {
        setTimeout(() => navigate("/login"), 1000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 -z-20 pointer-events-none"></canvas>
      <main className="flex-grow flex items-center justify-center relative min-h-screen pt-16 px-4 pb-8">
        {/* Split Layout Container */}
        <div className="w-full max-w-6xl glass-card rounded-2xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-fade-in-up">
          
          {/* Left Side: Branding / Visuals */}
          <div className="hidden lg:flex lg:w-1/2 bg-surface-container relative overflow-hidden p-12 flex-col justify-between group">
            <div className="absolute inset-0 bg-accent-gradient opacity-10 group-hover:opacity-20 transition-opacity duration-1000"></div>
            
            <div className="absolute top-[10%] right-[-10%] w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            
            <div className="relative z-10">
              <Link to="/" className="font-display-lg text-4xl bg-clip-text text-transparent bg-accent-gradient">
                ShortyURL
              </Link>
            </div>
            
            <div className="relative z-10 space-y-6">
              <h2 className="font-display-lg text-display-lg text-on-surface leading-tight">
                Join the <br /> <span className="text-secondary">Revolution</span>.
              </h2>
              <p className="font-body-lg text-on-surface-variant max-w-md">
                Create a free account today to start tracking, managing, and optimizing your links with powerful real-time analytics.
              </p>
            </div>
            
            <div className="relative z-10">
              <div className="glass-card p-4 rounded-xl border border-border-glass max-w-sm">
                <p className="font-body-sm text-on-surface-variant italic">"This platform completely changed how we handle our social media marketing. The analytics are incredibly fast."</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-bold text-on-surface text-label-sm">- Sarah K., Marketing Director</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="w-full lg:w-1/2 p-5 sm:p-10 md:p-14 flex flex-col justify-center relative bg-background/50 backdrop-blur-xl">
            <div className="w-full max-w-md mx-auto">
              <div className="text-left mb-6">
                <h1 className="font-display-lg text-headline-md md:text-display-md text-on-surface mb-2">Create Account</h1>
                <p className="text-on-surface-variant font-body-md">Start shortening and tracking your links today.</p>
              </div>

              {error && (
                <div className="mb-6 animate-fade-in-up">
                  <div className="bg-error-container text-on-error-container border border-error/20 px-4 py-3 rounded-xl flex items-center gap-3">
                    <span className="material-symbols-outlined">error</span>
                    <p className="font-label-sm text-sm font-bold">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-6 animate-fade-in-up">
                  <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-3 rounded-xl flex items-center gap-3">
                    <span className="material-symbols-outlined">check_circle</span>
                    <p className="font-label-sm text-sm font-bold">{success}</p>
                  </div>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <Input 
                  icon="mail"
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <div className="relative">
                  <Input 
                    icon="lock"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-12"
                  />
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none z-20" 
                    type="button"
                    tabIndex="-1"
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                
                {password.length > 0 && (
                  <div className="space-y-2 mt-[-0.5rem] mb-2 px-1">
                    <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                      <span className="text-on-surface-variant">Password Strength</span>
                      <span className={strengthColors[passwordStrength] ? strengthColors[passwordStrength].replace('bg-', 'text-') : "text-on-surface-variant"}>
                        {strengthLabels[passwordStrength]}
                      </span>
                    </div>
                    <div className="flex gap-1 h-1.5 w-full">
                      {[...Array(4)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 rounded-full transition-colors duration-300 ${i < passwordStrength ? strengthColors[passwordStrength] : 'bg-surface-container-highest'}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Input 
                  icon="lock"
                  label="Confirm Password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <div className="flex items-start gap-3 mt-4 mb-2">
                  <input className="mt-1 w-4 h-4 rounded border-border-glass bg-surface-container-lowest/50 text-secondary focus:ring-offset-background focus:ring-secondary" id="terms" type="checkbox" required />
                  <label className="font-body-md text-sm text-on-surface-variant leading-tight" htmlFor="terms">I agree to the <a className="text-secondary hover:underline transition-colors" href="#">Terms of Service</a> and <a className="text-secondary hover:underline transition-colors" href="#">Privacy Policy</a>.</label>
                </div>

                <Button 
                  className="w-full py-4 mt-6 !text-body-lg" 
                  variant="gradient"
                  type="submit"
                  loading={loading}
                >
                  Create Account
                </Button>
              </form>

              <div className="mt-8 flex items-center gap-4">
                <div className="h-px flex-grow bg-border-glass"></div>
                <span className="text-on-surface-variant text-label-sm uppercase">Or continue with</span>
                <div className="h-px flex-grow bg-border-glass"></div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button onClick={() => loginWithGoogle()} type="button" className="flex items-center justify-center gap-2 glass-card py-3.5 rounded-xl hover:bg-surface-glass transition-colors active:scale-95 group border border-border-glass">
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span className="font-label-sm text-on-surface">Google</span>
                </button>
                <button onClick={() => setShowSsoModal(true)} type="button" className="flex items-center justify-center gap-2 glass-card py-3.5 rounded-xl hover:bg-surface-glass transition-colors active:scale-95 group border border-border-glass">
                  <span className="material-symbols-outlined text-on-surface group-hover:scale-110 transition-transform">cloud_done</span>
                  <span className="font-label-sm text-on-surface">SSO</span>
                </button>
              </div>

              <div className="mt-8 text-center">
                <p className="font-body-md text-on-surface-variant">
                  Already have an account? 
                  <Link className="text-secondary font-bold hover:underline ml-2" to="/login">Sign in</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* SSO Info Modal */}
      {showSsoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in-up">
          <div className="glass-card rounded-2xl p-6 sm:p-8 max-w-md w-full border border-border-glass shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">corporate_fare</span>
            </div>
            <h3 className="font-display-lg text-headline-md text-on-surface">Enterprise SSO</h3>
            <p className="font-body-md text-on-surface-variant text-sm">Single Sign-On (SAML 2.0 / Okta / Azure AD) is available for Enterprise plan subscribers. Contact support or your IT administrator to configure workspace SSO.</p>
            <Button variant="gradient" onClick={() => setShowSsoModal(false)} className="w-full mt-4">Got It</Button>
          </div>
        </div>
      )}
    </>
  );
};

export default Register;
