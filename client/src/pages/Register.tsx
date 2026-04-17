import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const USERNAME_MIN = 3;
const USERNAME_MAX = 32;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 128;

function validateUsernameClient(u: string): string | null {
  const t = u.trim();
  if (!t) return "Username is required.";
  if (t.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (t.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters.`;
  if (!USERNAME_REGEX.test(t)) return "Username can only contain letters, numbers, and underscores.";
  return null;
}

function validatePasswordClient(p: string, requireLetterNumber: boolean): string | null {
  if (p.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (p.length > PASSWORD_MAX) return "Password must be at most 128 characters.";
  if (requireLetterNumber) {
    if (!/[a-zA-Z]/.test(p)) return "Password must contain at least one letter.";
    if (!/[0-9]/.test(p)) return "Password must contain at least one number.";
  }
  return null;
}

const Register: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const u = username.trim();
    const usernameErr = validateUsernameClient(u);
    if (usernameErr) {
      setError(usernameErr);
      return;
    }
    const passwordErr = validatePasswordClient(password, true);
    if (passwordErr) {
      setError(passwordErr);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await register(u, password);
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-primary/10 shadow-lg">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary text-transparent bg-clip-text">
            Create account
          </h1>
          <p className="text-muted-foreground text-sm">Join SoulSync</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                placeholder="3–32 characters, letters, numbers, underscores only"
                required
                autoComplete="username"
                className="rounded-lg"
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
              />
              <p className="text-xs text-muted-foreground">Letters, numbers, and underscores only. 3–32 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="At least 6 characters, include a letter and a number"
                required
                minLength={PASSWORD_MIN}
                autoComplete="new-password"
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">At least 6 characters. Must include at least one letter and one number.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="rounded-lg"
              />
            </div>
            <Button type="submit" className="w-full rounded-lg" disabled={submitting}>
              {submitting ? "Creating account…" : "Register"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
