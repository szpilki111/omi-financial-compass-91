
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
  // Don't show the selector if an account is already selected
  if (selectedAccount) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Wybierz konto:</label>
      <div className="grid gap-2 max-h-60 overflow-y-auto">
        {accounts.map((account) => (
          <Button
            key={account.id}
            variant="outline"
            className="justify-start h-auto p-3"
            onClick={() => onSelectAccount(account)}
          >
            <div className="text-left flex-1">
              <div className="font-medium">{account.number}</div>
              <div className="text-sm opacity-70">{account.name}</div>
              <div className="text-xs opacity-50">{account.type}</div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default AccountSelector;
