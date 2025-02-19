import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { 
  Menu,
  Search,
  ShoppingCart,
  Tractor,
  User,
  Plus,
  Loader2,
  ChevronDown,
  ImagePlus
} from "lucide-react";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact: z.string().optional(),
  imageUrl: z.string().optional(),
});

const equipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  dailyRate: z.coerce.number().min(1, "Daily rate must be at least ₹1"),
  location: z.string().min(1, "Location is required"),
  imageUrl: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type EquipmentFormData = z.infer<typeof equipmentSchema>;

const categories = [
  { id: "tractors", label: "Tractors" },
  { id: "harvesters", label: "Harvesters" },
  { id: "irrigation", label: "Irrigation" },
  { id: "seeders", label: "Seeders" },
  { id: "sprayers", label: "Sprayers" },
];

export function MainNav() {
  const { user, logoutMutation, updateProfileMutation } = useAuth();
  const { t } = useTranslation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPostEquipmentOpen, setIsPostEquipmentOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      contact: user?.contact || "",
      imageUrl: user?.imageUrl || "",
    },
  });

  const equipmentForm = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
      dailyRate: 0,
      location: "",
      imageUrl: "",
    },
  });

  async function onProfileSubmit(data: ProfileFormData) {
    try {
      await updateProfileMutation.mutateAsync(data);
      setIsProfileOpen(false);
      toast({
        title: t('profile.updateSuccess', 'Profile Updated'),
        description: t('profile.updateSuccessDesc', 'Your profile has been updated successfully'),
      });
    } catch (error) {
      toast({
        title: t('common.error', 'Error'),
        description: t('profile.errorOccurred', 'An error occurred while updating your profile'),
        variant: "destructive",
      });
    }
  }

  async function onEquipmentSubmit(data: EquipmentFormData) {
    try {
      setIsSubmitting(true);
      const formData = new FormData();

      // Add all form fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });

      const response = await fetch('/api/equipment', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to post equipment');
      }

      setIsPostEquipmentOpen(false);
      toast({
        title: t('equipment.createSuccess', 'Equipment Posted'),
        description: t('equipment.createSuccessDesc', 'Your equipment has been posted successfully'),
      });

      // Reset form and redirect
      equipmentForm.reset({
        name: "",
        category: "",
        description: "",
        dailyRate: 0,
        location: "",
        imageUrl: "",
      });
      setLocation('/dashboard');

    } catch (error) {
      console.error('Equipment submission error:', error);
      toast({
        title: t('common.error', 'Error'),
        description: error instanceof Error ? error.message : t('equipment.createError', 'Failed to post equipment. Please try again.'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/equipment?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setIsPostEquipmentOpen(open);
    if (!open) {
      equipmentForm.reset({
        name: "",
        category: "",
        description: "",
        dailyRate: 0,
        location: "",
        imageUrl: "",
      });
    }
  };

  return (
    <nav className="border-b bg-green-50/80 sticky top-0 z-50 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label={t('nav.menu', 'Menu')}>
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px]">
              <SheetHeader>
                <SheetTitle>{t('nav.menu', 'Menu')}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 py-4">
                <Link href="/equipment" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent">
                  <Tractor className="h-5 w-5" />
                  {t('nav.equipment', 'Equipment')}
                </Link>
                <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent">
                  <ShoppingCart className="h-5 w-5" />
                  {t('nav.bookings', 'Bookings')}
                </Link>
                {user?.isAdmin && (
                  <Link href="/admin" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent">
                    <User className="h-5 w-5" />
                    {t('nav.admin', 'Admin Dashboard')}
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-green-700">
            <Tractor className="h-6 w-6" />
            {t('branding.name', 'AgriRent')}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex flex-1 items-center justify-center px-8">
            {/* Categories Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1">
                  {t('nav.categories', 'Categories')}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {categories.map((category) => (
                  <DropdownMenuItem key={category.id} asChild>
                    <Link href={`/equipment?category=${category.id}`} className="w-full">
                      {t(`categories.${category.id}`, category.label)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t('search.placeholder', 'Search farming equipment...')}
                  className="w-full pl-10 pr-4"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t('search.label', 'Search equipment')}
                />
              </div>
            </form>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Post Equipment Button */}
            <Link href="/dashboard">
              <Button 
                variant="default" 
                className="hidden md:flex items-center gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  window.localStorage.setItem('openAddEquipment', 'true');
                }}
              >
                <Plus className="h-4 w-4" />
                {t('equipment.post', 'Post Equipment')}
              </Button>
            </Link>
              <Dialog>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('equipment.post', 'Post Equipment')}</DialogTitle>
                  <DialogDescription>
                    {t('equipment.postDesc', 'Fill in the details about your equipment for rent.')}
                  </DialogDescription>
                </DialogHeader>
                <Form {...equipmentForm}>
                  <form onSubmit={equipmentForm.handleSubmit(onEquipmentSubmit)} className="space-y-4">
                    <FormField
                      control={equipmentForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipment.name', 'Equipment Name')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={equipmentForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipment.category', 'Category')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('equipment.selectCategory', 'Select a category')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="tractors">{t('categories.tractors', 'Tractors')}</SelectItem>
                              <SelectItem value="harvesters">{t('categories.harvesters', 'Harvesters')}</SelectItem>
                              <SelectItem value="irrigation">{t('categories.irrigation', 'Irrigation')}</SelectItem>
                              <SelectItem value="seeders">{t('categories.seeders', 'Seeders')}</SelectItem>
                              <SelectItem value="sprayers">{t('categories.sprayers', 'Sprayers')}</SelectItem>
                              <SelectItem value="other">{t('categories.other', 'Other')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={equipmentForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipment.description', 'Description')}</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={equipmentForm.control}
                      name="dailyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipment.dailyRate', 'Daily Rate (₹)')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={field.value}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                field.onChange(isNaN(value) ? 0 : value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={equipmentForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipment.location', 'Location')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={equipmentForm.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipment.image', 'Equipment Image')}</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const formData = new FormData();
                                    formData.append('image', file);
                                    try {
                                      const res = await fetch('/api/equipment/image', {
                                        method: 'POST',
                                        credentials: 'include',
                                        body: formData
                                      });
                                      if (!res.ok) {
                                        throw new Error('Failed to upload image');
                                      }
                                      const data = await res.json();
                                      field.onChange(data.imageUrl);
                                      toast({
                                        title: t('common.success', 'Success'),
                                        description: t('equipment.imageUploadSuccess', 'Image uploaded successfully'),
                                      });
                                    } catch (error) {
                                      console.error('Image upload error:', error);
                                      toast({
                                        title: t('common.error', 'Error'),
                                        description: t('equipment.imageUploadError', 'Failed to upload image'),
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                              />
                              <ImagePlus className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('common.processing', 'Processing...')}
                        </>
                      ) : (
                        t('equipment.post', 'Post Equipment')
                      )}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />

            {/* Bookings */}
            <Link href="/dashboard">
              <Button 
                variant="ghost" 
                size="icon" 
                aria-label={t('nav.bookings', 'Your Bookings')}
              >
                <ShoppingCart className="h-5 w-5" />
              </Button>
            </Link>

            {/* Profile Menu */}
            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative h-8 w-8 rounded-full"
                  aria-label={t('profile.manage', 'Manage Profile')}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.imageUrl || '/default-avatar.png'} alt={user?.name} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('profile.edit', 'Edit Profile')}</DialogTitle>
                  <DialogDescription>
                    {t('profile.editDesc', 'Update your profile information below.')}
                  </DialogDescription>
                </DialogHeader>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.name', 'Name')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.contact', 'Contact')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.image', 'Profile Image')}</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <Input 
                                type="file" 
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const formData = new FormData();
                                    formData.append('image', file);
                                    try {
                                      const res = await fetch('/api/user/profile/image', {
                                        method: 'POST',
                                        credentials: 'include',
                                        body: formData
                                      });
                                      if (!res.ok) {
                                        throw new Error('Failed to upload profile image');
                                      }
                                      const data = await res.json();
                                      field.onChange(data.imageUrl);
                                      toast({
                                        title: t('common.success', 'Success'),
                                        description: t('profile.imageUploadSuccess', 'Profile image uploaded successfully'),
                                      });
                                    } catch (error) {
                                      console.error('Profile image upload error:', error);
                                      toast({
                                        title: t('common.error', 'Error'),
                                        description: t('profile.imageUploadError', 'Failed to upload profile image'),
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                              />
                              <ImagePlus className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t('profile.save', 'Save Changes')}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Logout Button */}
            <Button 
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="hidden sm:flex"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('nav.logout', 'Logout')
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}