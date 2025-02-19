import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Booking } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  const updateBookingStatus = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: string }) => {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('booking.updateError'));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: t('common.success'),
        description: t('booking.statusUpdateSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user?.isAdmin) {
    setLocation("/");
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">{t('admin.dashboard')}</h1>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">{t('admin.allBookings')}</h2>
        {bookings?.map((booking) => (
          <Card key={booking.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-medium mb-2">
                    {t('booking.number', { id: booking.id })}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('booking.userId', { id: booking.userId })}
                  </p>
                  <p className="text-muted-foreground">
                    {format(new Date(booking.startDate), "PP")} - 
                    {format(new Date(booking.endDate), "PP")}
                  </p>
                  <p className="text-muted-foreground mt-2">
                    {t('booking.currentStatus')}: <span className="capitalize">{t(`booking.status.${booking.status}`)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => 
                        updateBookingStatus.mutate({ 
                          bookingId: booking.id, 
                          status: 'approved' 
                        })
                      }
                      disabled={updateBookingStatus.isPending}
                    >
                      {updateBookingStatus.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t('booking.approve')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => 
                        updateBookingStatus.mutate({ 
                          bookingId: booking.id, 
                          status: 'rejected' 
                        })
                      }
                      disabled={updateBookingStatus.isPending}
                    >
                      {updateBookingStatus.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t('booking.reject')}
                    </Button>
                  </div>
                  <p className="mt-2 font-medium">
                    {t('common.total')}: {t('common.price', { price: booking.totalPrice })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}