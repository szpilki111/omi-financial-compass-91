import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UserDialog from "./UserDialog";
import { ScrollableTable } from "@/components/ui/ScrollableTable";
import { useAuth } from "@/context/AuthContext";

interface UserProfile {
  id: string;
  login: string;
  first_name: string;
  last_name: string;
  position: string;
  name: string; // kept for compatibility
  email: string;
  phone: string | null;
  role: string;
  location_id: string | null;
  created_at: string;
  blocked: boolean;
  location?: {
    name: string;
  };
  locations?: Array<{ name: string }>;
  last_successful_login?: string | null;
  last_failed_login?: string | null;
}

const getRoleBadgeProps = (role: string) => {
  switch (role) {
    case "admin":
      return { variant: "destructive" as const, className: "bg-red-100 text-red-800 border-red-200" };
    case "prowincjal":
      return { variant: "outline" as const, className: "bg-blue-100 text-blue-800 border-blue-200" };
    case "ekonom":
      return { variant: "outline" as const, className: "bg-green-100 text-green-800 border-green-200" };
    default:
      return { variant: "outline" as const, className: "bg-gray-100 text-gray-800 border-gray-200" };
  }
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case "admin":
      return "Administrator";
    case "prowincjal":
      return "Prowincjał";
    case "ekonom":
      return "Ekonom";
    case "proboszcz":
      return "Proboszcz";
    case "asystent":
      return "Asystent";
    case "asystent_ekonoma_prowincjalnego":
      return "Asystent Ekonoma Prowincjalnego";
    case "ekonom_prowincjalny":
      return "Ekonom Prowincjalny";
    default:
      return role;
  }
};

const UsersManagement = () => {
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<(UserProfile & { location_ids?: string[] }) | null>(null);
  const [displayedCount, setDisplayedCount] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const loadMoreRef = useRef<HTMLTableRowElement>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      // Get users with their login events
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(
          `
          *,
          location:locations(name)
        `,
        )
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get latest login events and locations for each user
      const usersWithDetails = await Promise.all(
        profiles.map(async (profile) => {
          // Normalize email for consistent queries
          const normalizedEmail = profile.email?.toLowerCase().trim();

          // Get last successful login (using user_id)
          const { data: successfulLogin } = await supabase
            .from("user_login_events")
            .select("created_at")
            .eq("user_id", profile.id)
            .eq("success", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get last failed login (using email because failed logins have user_id = null)
          const { data: failedLogin } = await supabase
            .from("user_login_events")
            .select("created_at")
            .eq("email", normalizedEmail)
            .eq("success", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get user locations from user_locations table
          const { data: userLocs } = await supabase
            .from("user_locations")
            .select("location_id, locations(name)")
            .eq("user_id", profile.id);

          const locations = userLocs?.map(ul => ({ name: (ul.locations as any)?.name })) || [];

          return {
            ...profile,
            locations,
            last_successful_login: successfulLogin?.created_at || null,
            last_failed_login: failedLogin?.created_at || null,
          };
        }),
      );

      return usersWithDetails as UserProfile[];
    },
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && users && displayedCount < users.length) {
          setDisplayedCount((prev) => Math.min(prev + 1, users.length));
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [users, displayedCount]);

  // Reset displayed count when users data changes
  useEffect(() => {
    setDisplayedCount(1);
  }, [users]);

  // Mutacja do usuwania użytkownika używając logiki z Login
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log("Rozpoczynanie procesu usuwania użytkownika przez administratora...");

      // Sprawdź, czy administrator jest zalogowany
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error("Brak sesji administratora");
      }

      // Zapisz aktualną sesję
      const adminSession = currentSession;
      console.log("Sesja administratora zapisana:", adminSession.user.email);

      try {
        // Najpierw usuń profil użytkownika
        const { error: profileDeleteError } = await supabase.from("profiles").delete().eq("id", userId);

        if (profileDeleteError) {
          console.error("Error deleting profile:", profileDeleteError);
          throw new Error("Nie udało się usunąć profilu użytkownika");
        }

        console.log("Profil użytkownika usunięty pomyślnie");
      } catch (error) {
        // W przypadku błędu, zawsze przywróć sesję administratora
        try {
          await supabase.auth.setSession(adminSession);
          console.log("Sesja administratora przywrócona po błędzie");
        } catch (restoreError) {
          console.error("Nie udało się przywrócić sesji administratora:", restoreError);
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Użytkownik został usunięty pomyślnie",
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      console.error("Error deleting user:", error);
      let errorMessage = "Nie udało się usunąć użytkownika";

      if (error.message?.includes("User not found")) {
        errorMessage = "Użytkownik nie został znaleziony";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Błąd",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Mutation to toggle user blocked status
  const toggleUserBlockedMutation = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      // Pobierz email użytkownika
      const { data: userProfile } = await supabase.from("profiles").select("email").eq("id", userId).single();

      const { error } = await supabase.from("profiles").update({ blocked }).eq("id", userId);

      if (error) throw error;

      // Jeśli odblokowujemy użytkownika, wyczyść historię nieudanych logowań
      if (!blocked && userProfile) {
        await supabase.from("user_login_events").delete().eq("user_id", userId).eq("success", false);

        // Wyczyść także tabelę failed_logins
        await supabase.from("failed_logins").delete().eq("email", userProfile.email);
      }
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Sukces",
        description: variables.blocked
          ? "Użytkownik został zablokowany"
          : "Użytkownik został odblokowany i historia nieudanych logowań została wyczyszczona",
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      console.error("Error toggling user blocked status:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować statusu blokady",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const handleToggleBlocked = (userId: string, blocked: boolean) => {
    toggleUserBlockedMutation.mutate({ userId, blocked });
  };

  const userRole = user?.role;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center">Ładowanie użytkowników...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Zarządzanie użytkownikami</CardTitle>
          <Button onClick={() => setIsUserDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj użytkownika
          </Button>
        </CardHeader>
        <CardContent>
          {!users?.length ? (
            <p className="text-center text-omi-gray-500">Brak użytkowników w systemie.</p>
          ) : (
            <ScrollableTable>
              <Table style={{ minWidth: "1400px" }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Login</TableHead>
                    <TableHead>Imię i nazwisko</TableHead>
                    <TableHead>Stanowisko</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Placówka</TableHead>
                    {(userRole === "prowincjal" || userRole === "admin") && (
                      <>
                        <TableHead>Ostatnie udane</TableHead>
                        <TableHead>Ostatnie nieudane</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.slice(0, displayedCount).map((user, index) => (
                    <TableRow key={user.id} ref={index === displayedCount - 1 ? loadMoreRef : null}>
                      <TableCell className="font-medium">{user.login}</TableCell>
                      <TableCell>{`${user.first_name} ${user.last_name}`}</TableCell>
                      <TableCell>{user.position}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge {...getRoleBadgeProps(user.role)}>{getRoleLabel(user.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.locations && user.locations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.locations.map((loc, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {loc.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {(userRole === "prowincjal" || userRole === "admin") && (
                        <>
                          <TableCell>
                            {user.last_successful_login ? (
                              <span className="text-green-600 text-sm">
                                {new Date(user.last_successful_login).toLocaleString("pl-PL")}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.last_failed_login ? (
                              <span className="text-red-600 text-sm">
                                {new Date(user.last_failed_login).toLocaleString("pl-PL")}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {user.blocked ? (
                                <Badge variant="destructive" className="text-xs">
                                  Zablokowane
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200"
                                >
                                  Aktywne
                                </Badge>
                              )}
                              {(userRole === "prowincjal" || userRole === "admin") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleBlocked(user.id, !user.blocked)}
                                  disabled={toggleUserBlockedMutation.isPending}
                                  className="h-7 w-7 p-0" // mały kwadratowy przycisk
                                            >
                                  {user.blocked ? (
                                    <Lock className="h-3 w-3" />
                                  ) : (
                                    <Unlock className="h-3 w-3" />
                                  )}
                              )}
                            </div>
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              // Fetch user locations before editing
                              const { data: userLocs } = await supabase
                                .from('user_locations')
                                .select('location_id')
                                .eq('user_id', user.id);
                              
                              setEditingUser({
                                ...user,
                                location_ids: userLocs?.map(ul => ul.location_id) || []
                              });
                              setIsUserDialogOpen(true);
                            }}
                          >
                            Edytuj
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                disabled={deleteUserMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Usuń użytkownika</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Czy na pewno chcesz usunąć użytkownika{" "}
                                  <strong>
                                    {user.first_name} {user.last_name}
                                  </strong>
                                  ? Ta operacja jest nieodwracalna i usunie wszystkie dane związane z tym użytkownikiem.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Usuń użytkownika
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {displayedCount < users.length && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-4">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                          Ładowanie kolejnych użytkowników...
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
        </CardContent>
      </Card>

      <UserDialog
        open={isUserDialogOpen}
        onOpenChange={(open) => {
          setIsUserDialogOpen(open);
          if (!open) {
            setEditingUser(null);
          }
        }}
        editingUser={editingUser}
      />
    </>
  );
};

export default UsersManagement;
