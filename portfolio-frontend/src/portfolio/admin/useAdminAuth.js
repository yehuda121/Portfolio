import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  adminCheckAuth,
  adminLogin,
  adminLogout,
  getQuizAdminToken,
  setQuizAdminToken,
  subscribeAdminUnauthorized,
} from "../../api/quizApi";

export function useAdminAuth() {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loginOpen, setLoginOpen] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const applyLoggedOut = useCallback(() => {
    setAuthenticated(false);
    setLoginOpen(true);
    setPassword("");
    setLoginError(null);
  }, []);

  const checkAuth = useCallback(async () => {
    if (!getQuizAdminToken()) {
      applyLoggedOut();
      setCheckingAuth(false);
      return;
    }
    const result = await adminCheckAuth();
    setCheckingAuth(false);
    if (!result.ok || !result.data?.authenticated) {
      setQuizAdminToken("");
      applyLoggedOut();
      return;
    }
    setAuthenticated(true);
    setLoginOpen(false);
  }, [applyLoggedOut]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    return subscribeAdminUnauthorized(() => {
      applyLoggedOut();
    });
  }, [applyLoggedOut]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    const result = await adminLogin(password);
    setLoginLoading(false);

    if (!result.ok || !result.data?.token) {
      setLoginError(t("Quiz.admin.errors.loginFailed"));
      return;
    }

    setQuizAdminToken(result.data.token);
    setAuthenticated(true);
    setLoginOpen(false);
    setPassword("");
  };

  const handleLogout = async () => {
    await adminLogout();
    setQuizAdminToken("");
    applyLoggedOut();
  };

  return {
    authenticated,
    checkingAuth,
    loginOpen,
    password,
    setPassword,
    loginError,
    loginLoading,
    handleLogin,
    handleLogout,
  };
}
