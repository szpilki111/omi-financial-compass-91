
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpirTransaction } from '@/types/kpir';
import { Pencil, Split, CornerDownRight, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface KpirTransactionCardProps {
  transaction: KpirTransaction;
  onEditTransaction?: (transaction: KpirTransaction) => void;
  onShowDocument?: (doc: KpirTransaction["document"]) => void;
  isSubTransaction?: boolean;
  isLastSubTransaction?: boolean;
}

const KpirTransactionCard: React.FC<KpirTransactionCardProps> = ({
  transaction,
  onEditTransaction,
  onShowDocument,
  isSubTransaction = false,
  isLastSubTransaction = false
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

  const renderAmount = (amount: number | undefined, type: 'debit' | 'credit', account: any) => {
    if (!amount || amount <= 0) return null;

    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            type === 'debit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {type === 'debit' ? 'W' : 'M'}
          </div>
          <div>
            <div className={`font-semibold ${
              type === 'debit' ? 'text-green-700' : 'text-red-700'
            }`}>
              {amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} 
              {transaction.currency !== 'PLN' && ` ${transaction.currency}`}
            </div>
            <div className="text-xs text-gray-600">
              {account?.number} - {account?.name}
            </div>
          </div>
        </div>
        <div className="flex space-x-1">
          {!isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditTransaction?.(transaction)}
              className="h-8 w-8 p-0"
              title="Edytuj transakcję"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderLegacyAmount = () => {
    if (typeof transaction.debit_amount === 'number' || typeof transaction.credit_amount === 'number') {
      return null; // Use new format
    }

    // Legacy format with single amount
    return (
      <>
        {renderAmount(transaction.amount, 'debit', transaction.debitAccount)}
        {renderAmount(transaction.amount, 'credit', transaction.creditAccount)}
      </>
    );
  };

  return (
    <Card className={`${isSubTransaction ? 'ml-8 border-l-4 border-l-blue-300 bg-blue-50/30' : ''}`}>
      <CardContent className="p-4">
        {/* Header with date, document number and description */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {isSubTransaction && (
              <div className="flex items-center mr-3 text-blue-600">
                <div className="flex flex-col items-center">
                  <div className="w-px h-4 bg-blue-300"></div>
                  <div className="flex items-center">
                    <div className="w-6 h-px bg-blue-300"></div>
                    <CornerDownRight className="h-4 w-4 ml-1 text-blue-500" />
                  </div>
                  {!isLastSubTransaction && <div className="w-px h-4 bg-blue-300"></div>}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">
                  {transaction.formattedDate}
                </span>
                <span className="text-gray-500">
                  {transaction.document_number || '-'}
                </span>
                {!isSubTransaction && transaction.parent_transaction_id === undefined && (
                  // Check if this transaction has subtransactions (is a split parent)
                  <Split className="h-4 w-4 text-orange-500" />
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {transaction.description}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {transaction.currency}
              {transaction.currency !== 'PLN' && transaction.exchange_rate && (
                <span className="text-xs text-gray-400 block">
                  kurs: {transaction.exchange_rate.toFixed(4)}
                </span>
              )}
            </span>
            <span className="text-sm text-gray-500">
              {transaction.settlement_type}
            </span>
            {transaction.document && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShowDocument?.(transaction.document)}
                className="h-8 w-8 p-0"
                title="Zobacz dokument"
              >
                <Search className="h-4 w-4 text-blue-700" />
              </Button>
            )}
          </div>
        </div>

        {/* Transaction amounts */}
        <div className="space-y-2">
          {/* New format with separate debit/credit amounts */}
          {typeof transaction.debit_amount === 'number' && transaction.debit_amount > 0 && 
            renderAmount(transaction.debit_amount, 'debit', transaction.debitAccount)
          }
          {typeof transaction.credit_amount === 'number' && transaction.credit_amount > 0 && 
            renderAmount(transaction.credit_amount, 'credit', transaction.creditAccount)
          }
          
          {/* Legacy format fallback */}
          {renderLegacyAmount()}
        </div>
      </CardContent>
    </Card>
  );
};

export default KpirTransactionCard;
