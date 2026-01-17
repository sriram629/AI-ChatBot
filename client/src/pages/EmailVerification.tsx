import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { Loader2, Mail } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import logo from "@/assets/transparent-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const EmailVerification = () => {
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const navigate = useNavigate();
  const { verifyEmail, resendOtp, userEmail } = useAuth();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (value.length === 6) {
      setIsLoading(true);
      try {
        await verifyEmail(value);
        navigate("/chat");
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleResend = async () => {
    if (!userEmail) {
      toast.error("User email session expired. Please register again.");
      return;
    }

    setIsResending(true);
    try {
      await resendOtp(userEmail);
      setCountdown(60);
      setValue("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="AI Chat Logo" className="w-20 h-20" />
          </div>
          <CardTitle className="text-2xl text-center">
            Verify your email
          </CardTitle>
          <CardDescription className="text-center flex flex-col items-center gap-2">
            <span className="flex items-center gap-2 text-primary font-medium">
              <Mail className="w-4 h-4" /> {userEmail || "your email"}
            </span>
            We've sent a 6-digit verification code to the address above.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={value}
              onChange={setValue}
              disabled={isLoading}
              autoFocus
            >
              <InputOTPGroup className="gap-3">
                {[...Array(6)].map((_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="w-12 h-14 text-lg border-2"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerify}
            className="w-full h-11"
            disabled={value.length !== 6 || isLoading || isResending}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Continue"
            )}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?
            </p>
            <button
              onClick={handleResend}
              disabled={isLoading || isResending || countdown > 0}
              className="text-sm font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline transition-all"
            >
              {isResending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Sending...
                </span>
              ) : countdown > 0 ? (
                `Resend available in ${countdown}s`
              ) : (
                "Resend OTP"
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};

export default EmailVerification;
