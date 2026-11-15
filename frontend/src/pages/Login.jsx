import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { AuthContext } from "../context/AuthContext";
import { apiFetch, API_URL } from "../utils/api";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useToast } from "../context/ToastContextInstance";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, login, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showSsoModal, setShowSsoModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      addToast("Please enter your email address", "error");
      return;
    }
    setResetLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail })
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || `Password reset link sent to ${resetEmail}`, "success");
        setShowForgotModal(false);
        setResetEmail("");
      } else {
        addToast(data.message || "Failed to request password reset", "error");
      }
    } catch (err) {
      console.error("Password reset error:", err);
      addToast("Failed to request password reset", "error");
    } finally {
      setResetLoading(false);
    }
  };

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
    setLoading(true);

    try {
      const res = await apiFetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }, user, login, logout);

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials");
      }

      login(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center relative bg-radial-glow min-h-screen pt-16 px-4 pb-8">
      {/* Split Layout Container */}
      <div className="w-full max-w-6xl glass-card rounded-2xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-fade-in-up">
        
        {/* Left Side: Branding / Visuals */}
        <div className="hidden lg:flex lg:w-1/2 bg-surface-container relative overflow-hidden p-12 flex-col justify-between group">
          <div className="absolute inset-0 bg-accent-gradient opacity-10 group-hover:opacity-20 transition-opacity duration-1000"></div>
          
          {/* Animated Orbs for branding side */}
          <div className="absolute top-[-20%] left-[-10%] w-[400px] h-[400px] bg-tertiary/20 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] bg-primary/20 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }}></div>
          
          <div className="relative z-10">
            <Link to="/" className="font-display-lg text-4xl bg-clip-text text-transparent bg-accent-gradient">
              ShortyURL
            </Link>
          </div>
          
          <div className="relative z-10 space-y-6">
            <h2 className="font-display-lg text-display-lg text-on-surface leading-tight">
              Manage your links <br /> like a <span className="text-tertiary">Pro</span>.
            </h2>
            <p className="font-body-lg text-on-surface-variant max-w-md">
              Gain actionable insights, customize aliases, and orchestrate your marketing campaigns with our ultra-premium link shortener.
            </p>
          </div>
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex -space-x-4">
              <img className="w-10 h-10 rounded-full border-2 border-surface-container" src="https://i.pravatar.cc/100?img=1" alt="User" />
              <img className="w-10 h-10 rounded-full border-2 border-surface-container" src="https://i.pravatar.cc/100?img=2" alt="User" />
              <img className="w-10 h-10 rounded-full border-2 border-surface-container" src="https://i.pravatar.cc/100?img=3" alt="User" />
            </div>
            <span className="font-label-sm text-on-surface-variant">Trusted by 10,000+ users</span>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full lg:w-1/2 p-5 sm:p-10 md:p-14 flex flex-col justify-center relative bg-background/50 backdrop-blur-xl">
          <div className="w-full max-w-md mx-auto">
            <div className="text-left mb-8">
              <h1 className="font-display-lg text-headline-md md:text-display-md text-on-surface mb-2">Welcome Back</h1>
              <p className="text-on-surface-variant font-body-md">Sign in to access your dashboard.</p>
            </div>

            {error && (
              <div className="mb-6 animate-fade-in-up">
                <div className="bg-error-container text-on-error-container border border-error/20 px-4 py-3 rounded-xl flex items-center gap-3">
                  <span className="material-symbols-outlined">error</span>
                  <p className="font-label-sm text-sm font-bold">{error}</p>
                </div>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
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

              <div className="flex justify-end mt-1">
                <button onClick={() => setShowForgotModal(true)} type="button" className="text-tertiary font-label-sm hover:underline">Forgot Password?</button>
              </div>

              <Button 
                className="w-full py-4 mt-8 !text-body-lg" 
                variant="gradient"
                type="submit"
                loading={loading}
              >
                Sign In
              </Button>
            </form>

            <div className="mt-8 flex items-center gap-4">
              <div className="h-px flex-grow bg-border-glass"></div>
              <span className="text-on-surface-variant text-label-sm uppercase">Or continue with</span>
              <div className="h-px flex-grow bg-border-glass"></div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button onClick={() => loginWithGoogle()} type="button" className="flex items-center justify-center gap-2 glass-card py-3.5 rounded-xl hover:bg-surface-glass transition-colors active:scale-95 group border border-border-glass">
                <img className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnBrTNiusQg_M--qqOJCaDy-Z_L4P7cyAwngjo8dRNICz_Z53H6Y0o_xCZinjmAg5EnCKLwU2Otf5rGd_GfyLeFpPpPpu4u55EYwMxat2JnFmkMXqVAkwOOhJzhhxhwwCOMifsfsE83R4R3hrxEq3kkjp_8NPfgEm-k3wZv00XSYyYMrmsZPKP3ps_pU6EXN3qpc3YeUclw3I6CDGod68z-BmFhpVU0hPbyYWS8oevx7tReduL1bXZgg0kC8NMEa90uJlw3JF8Z_3k"/>
                <span className="font-label-sm text-on-surface">Google</span>
              </button>
              <button onClick={() => setShowSsoModal(true)} type="button" className="flex items-center justify-center gap-2 glass-card py-3.5 rounded-xl hover:bg-surface-glass transition-colors active:scale-95 group border border-border-glass">
                <span className="material-symbols-outlined text-on-surface group-hover:scale-110 transition-transform">cloud_done</span>
                <span className="font-label-sm text-on-surface">SSO</span>
              </button>
            </div>

            <div className="mt-8 text-center">
              <p className="text-on-surface-variant font-body-md">
                Don't have an account? 
                <Link className="text-tertiary font-bold hover:underline ml-2" to="/register">Sign up</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in-up">
          <div className="glass-card rounded-2xl p-6 sm:p-8 max-w-md w-full border border-border-glass shadow-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-display-lg text-headline-md text-on-surface">Reset Password</h3>
              <button onClick={() => setShowForgotModal(false)} className="material-symbols-outlined text-on-surface-variant hover:text-on-surface">close</button>
            </div>
            <p className="font-body-md text-on-surface-variant text-sm">Enter your account email address and we'll send you instructions to reset your password.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <Input
                icon="mail"
                label="Account Email"
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setShowForgotModal(false)} type="button">Cancel</Button>
                <Button variant="gradient" type="submit" loading={resetLoading}>Send Reset Link</Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </main>
  );
};

export default Login;
