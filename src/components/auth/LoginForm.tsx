import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  HiOutlineEnvelope,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeSlash,
} from "react-icons/hi2";
import "./login.css";

const LoginForm: React.FC = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  /**
   * Handle Input Change
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setApiError(null);
  };

  /**
   * Handle Form Submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);

    const { email, password } = formData;

    try {
      // Authenticate user
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error("Incorrect email or password.");
      }

      if (data.user) {
        console.log("Login successful. Redirecting to dashboard...");
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Login error:", err.message);
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      {apiError && <div className="alert alert-error">{apiError}</div>}

      {/* Email Input */}
      <div className="form-item">
        <span className="input-icon">
          <HiOutlineEnvelope />
        </span>
        <input
          type="email"
          name="email"
          placeholder="Enter Email"
          value={formData.email}
          onChange={handleChange}
          disabled={isLoading}
        />
      </div>

      {/* Password Input */}
      <div className="form-item">
        <span className="input-icon">
          <HiOutlineLockClosed />
        </span>
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          placeholder="Enter Password"
          value={formData.password}
          onChange={handleChange}
          disabled={isLoading}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
        </button>
      </div>

      <button type="submit" className="login-btn" disabled={isLoading}>
        {isLoading ? "Signing In..." : "Sign In"}
      </button>
    </form>
  );
};

export default LoginForm;
