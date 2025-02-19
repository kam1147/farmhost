import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function AuthPage() {
  const [_, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  const loginForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "", name: "" },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "", name: "" },
  });

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>

        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t('auth.login', 'Login')}</TabsTrigger>
                <TabsTrigger value="register">{t('auth.register', 'Register')}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form 
                  onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}
                  className="space-y-4 mt-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="login-username">{t('auth.username', 'Username')}</Label>
                    <Input 
                      id="login-username"
                      {...loginForm.register("username")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password', 'Password')}</Label>
                    <Input 
                      id="login-password"
                      type="password"
                      {...loginForm.register("password")}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('auth.loginButton', 'Sign In')}
                  </Button>
                  <Button
                    variant="link"
                    className="w-full"
                    onClick={() => {/* TODO: Implement password reset */}}
                  >
                    {t('auth.forgotPassword', 'Forgot Password?')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form 
                  onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))}
                  className="space-y-4 mt-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="register-username">{t('auth.username', 'Username')}</Label>
                    <Input 
                      id="register-username"
                      {...registerForm.register("username")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{t('auth.password', 'Password')}</Label>
                    <Input 
                      id="register-password"
                      type="password"
                      {...registerForm.register("password")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-name">{t('auth.fullName', 'Full Name')}</Label>
                    <Input 
                      id="register-name"
                      {...registerForm.register("name")}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('auth.registerButton', 'Create Account')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div 
        className="hidden md:flex flex-col justify-center p-8 bg-cover bg-center text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('https://images.unsplash.com/photo-1444858291040-58f756a3bdd6')`,
        }}
      >
        <div className="max-w-xl">
          <h1 className="text-4xl font-bold mb-4">
            {t('home.title', 'Agricultural Equipment Rental Platform')}
          </h1>
          <p className="text-lg opacity-90">
            {t('home.description', 'Connect with equipment owners and find the machinery you need for your farming operations. Get access to a wide range of agricultural equipment at competitive rates.')}
          </p>
        </div>
      </div>
    </div>
  );
}