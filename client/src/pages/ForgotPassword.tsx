import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react"; // Added Loader2
import AuthLayout from "@/components/AuthLayout";
import logo from "@/assets/transparent-logo.png";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext"; // Import AuthContext

type Step = "email" | "password" | "otp";

const ForgotPassword = () => {
  const { requestPasswordReset, confirmPasswordReset } = useAuth(); // Hook into Backend
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Loading state

  // Step 1: Submit Email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    setStep("password");
  };

  // Step 2: Validate Password & Request OTP
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- VALIDATIONS ---
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      // Call Backend to generate OTP
      await requestPasswordReset(email, password);
      setStep("otp");
    } catch (error) {
      // Error is handled in AuthContext (toasts), but we stop loading here
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify OTP & Finalize
  const handleOtpVerify = async () => {
    if (otp.length !== 6) return;

    setIsLoading(true);
    try {
      // Call Backend to verify OTP and update password
      await confirmPasswordReset(email, otp, password);
      navigate("/login");
    } catch (error) {
      // Error handled in context
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      await requestPasswordReset(email, password);
      setOtp("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="glass-morphism border-border/50">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="AI Chat Logo" className="w-20 h-20" />
          </div>
          <CardTitle className="text-2xl text-center">
            {step === "email" && "Reset password"}
            {step === "password" && "Create new password"}
            {step === "otp" && "Verify your email"}
          </CardTitle>
          <CardDescription className="text-center">
            {step === "email" && "Enter your email address to continue"}
            {step === "password" && "Choose a strong password for your account"}
            {step === "otp" && `We've sent a 6-digit code to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* STEP 1: EMAIL */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          )}

          {/* STEP 2: PASSWORD CREATION */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-background/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Send OTP"
                )}
              </Button>
            </form>
          )}

          {/* STEP 3: OTP VERIFICATION */}
          {step === "otp" && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup className="gap-3">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="w-12 h-14 text-lg border-2"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleOtpVerify}
                className="w-full"
                disabled={otp.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Verify & Reset Password"
                )}
              </Button>

              <div className="text-center">
                <button
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  Didn't receive the code?{" "}
                  <span className="text-primary">Resend</span>
                </button>
              </div>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};

export default ForgotPassword;
