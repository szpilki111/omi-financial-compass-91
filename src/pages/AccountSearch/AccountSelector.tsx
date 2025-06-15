
import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccount: Account | null;
  onSelectAccount: (account: Account) => void;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  selectedAccount,
  onSelectAccount,
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Wybierz konto:</label>
      <div className="grid gap-2 max-h-60 overflow-y-auto">
        {accounts.map((account) => (
          <Button
            key={account.id}
            variant={selectedAccount?.id === account.id ? "default" : "outline"}
            className="justify-start h-auto p-3"
            onClick={() => onSelectAccount(account)}
          >
            <div className="flex items-center gap-2 w-full">
              {selectedAccount?.id === account.id && (
                <Check className="h-4 w-4 text-white" />
              )}
              <div className="text-left flex-1">
                <div className="font-medium">{account.number}</div>
                <div className="text-sm opacity-70">{account.name}</div>
                <div className="text-xs opacity-50">{account.type}</div>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default AccountSelector;
