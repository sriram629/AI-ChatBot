import { useState } from "react";
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
import AuthLayout from "@/components/AuthLayout";
import logo from "@/assets/transparent-logo.png";
import { useAuth } from "@/contexts/AuthContext";

const EmailVerification = () => {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  const { verifyEmail } = useAuth();

  const handleVerify = async () => {
    if (value.length === 6) {
      try {
        await verifyEmail(value);
        navigate("/chat");
      } catch (e) {
        // stay here
      }
    }
  };

  const handleResend = () => {
    setValue("");
    // Mock resend logic
  };

  return (
    <AuthLayout>
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">
            Check your email
          </CardTitle>
          <CardDescription className="text-center">
            We've sent a 6-digit verification code to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={value} onChange={setValue}>
              <InputOTPGroup className="gap-3">
                <InputOTPSlot
                  index={0}
                  className="w-12 h-14 text-lg border-2"
                />
                <InputOTPSlot
                  index={1}
                  className="w-12 h-14 text-lg border-2"
                />
                <InputOTPSlot
                  index={2}
                  className="w-12 h-14 text-lg border-2"
                />
                <InputOTPSlot
                  index={3}
                  className="w-12 h-14 text-lg border-2"
                />
                <InputOTPSlot
                  index={4}
                  className="w-12 h-14 text-lg border-2"
                />
                <InputOTPSlot
                  index={5}
                  className="w-12 h-14 text-lg border-2"
                />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerify}
            className="w-full"
            disabled={value.length !== 6}
          >
            Verify Email
          </Button>

          <div className="text-center">
            <button
              onClick={handleResend}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Didn't receive the code?{" "}
              <span className="text-primary">Resend</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};

export default EmailVerification;
