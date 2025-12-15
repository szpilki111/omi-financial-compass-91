import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Spinner } from '@/components/ui/Spinner';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Hash, 
  Search,
  Users,
  Calculator,
  CreditCard
} from 'lucide-react';

interface Location {
  id: string;
  name: string;
  address: string | null;
  nip: string | null;
  regon: string | null;
  location_identifier: string | null;
}

interface LocationWithAccounts extends Location {
  accounts: Array<{
    id: string;
    number: string;
    name: string;
    type: string;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    position: string | null;
  }>;
}

const ContactsDirectory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLocations, setExpandedLocations] = useState<string[]>([]);

  // Fetch locations with related data
  const { data: locationsData, isLoading } = useQuery({
    queryKey: ['contacts-directory'],
    queryFn: async () => {
      // Fetch locations
      const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (locError) throw locError;

      // Fetch all accounts
      const { data: accounts, error: accError } = await supabase
        .from('accounts')
        .select('id, number, name, type')
        .order('number');

      if (accError) throw accError;

      // Fetch all users/profiles
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role, position, location_id')
        .order('name');

      if (profError) throw profError;

      // Combine data
      const locationsWithData: LocationWithAccounts[] = (locations || []).map(loc => {
        // Filter accounts by location identifier
        const locationAccounts = (accounts || []).filter(acc => {
          if (!loc.location_identifier) return false;
          return acc.number.includes(`-${loc.location_identifier}`) || 
                 acc.number.includes(`-${loc.location_identifier}-`);
        });

        // Filter users by location_id
        const locationUsers = (profiles || []).filter(p => p.location_id === loc.id);

        return {
          ...loc,
          accounts: locationAccounts,
          users: locationUsers
        };
      });

      return locationsWithData;
    }
  });

  // Filter locations based on search
  const filteredLocations = locationsData?.filter(loc => {
    const search = searchTerm.toLowerCase();
    return (
      loc.name.toLowerCase().includes(search) ||
      loc.address?.toLowerCase().includes(search) ||
      loc.location_identifier?.toLowerCase().includes(search) ||
      loc.users.some(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)) ||
      loc.accounts.some(a => a.number.includes(search) || a.name.toLowerCase().includes(search))
    );
  });

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, { label: string; color: string }> = {
      'admin': { label: 'Administrator', color: 'bg-red-500' },
      'prowincjal': { label: 'Prowincjał', color: 'bg-purple-500' },
      'ekonom': { label: 'Ekonom', color: 'bg-blue-500' },
      'proboszcz': { label: 'Proboszcz', color: 'bg-green-500' },
      'asystent': { label: 'Asystent', color: 'bg-yellow-500' },
    };
    const roleInfo = roleLabels[role] || { label: role, color: 'bg-gray-500' };
    return (
      <Badge className={`${roleInfo.color} text-white text-xs`}>
        {roleInfo.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj placówki, osoby lub konta..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{locationsData?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Placówek</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {locationsData?.reduce((sum, loc) => sum + loc.users.length, 0) || 0}
                </p>
                <p className="text-sm text-muted-foreground">Użytkowników</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Calculator className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {locationsData?.reduce((sum, loc) => sum + loc.accounts.length, 0) || 0}
                </p>
                <p className="text-sm text-muted-foreground">Kont</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations list */}
      {filteredLocations?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Brak placówek do wyświetlenia</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion 
          type="multiple" 
          value={expandedLocations}
          onValueChange={setExpandedLocations}
          className="space-y-4"
        >
          {filteredLocations?.map(location => (
            <AccordionItem 
              key={location.id} 
              value={location.id}
              className="border rounded-lg bg-card overflow-hidden"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-4 text-left">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{location.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      {location.location_identifier && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {location.location_identifier}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {location.users.length} osób
                      </span>
                      <span className="flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        {location.accounts.length} kont
                      </span>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-6 pb-4 space-y-6">
                  {/* Location details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {location.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{location.address}</span>
                      </div>
                    )}
                    {location.nip && (
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span>NIP: {location.nip}</span>
                      </div>
                    )}
                    {location.regon && (
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span>REGON: {location.regon}</span>
                      </div>
                    )}
                  </div>

                  {/* Users */}
                  {location.users.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Osoby kontaktowe ({location.users.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {location.users.map(user => (
                          <div 
                            key={user.id} 
                            className="p-3 rounded-lg border border-border bg-muted/30"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{user.name}</p>
                                {user.position && (
                                  <p className="text-sm text-muted-foreground">{user.position}</p>
                                )}
                              </div>
                              {getRoleBadge(user.role)}
                            </div>
                            <div className="mt-2 space-y-1">
                              <a 
                                href={`mailto:${user.email}`}
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </a>
                              {user.phone && (
                                <a 
                                  href={`tel:${user.phone}`}
                                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                                >
                                  <Phone className="h-3 w-3" />
                                  {user.phone}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accounts */}
                  {location.accounts.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Konta ({location.accounts.length})
                      </h4>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-1">
                          {location.accounts.map(account => (
                            <div 
                              key={account.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm"
                            >
                              <div className="flex items-center gap-3">
                                <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                                  {account.number}
                                </code>
                                <span className="text-muted-foreground">{account.name}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {account.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default ContactsDirectory;
