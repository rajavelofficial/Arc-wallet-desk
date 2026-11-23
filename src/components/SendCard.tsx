import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { erc20Abi, isAddress } from 'viem'
import { Loader2, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { TARGET_CHAIN_ID, USDC_ADDRESS, chainFacts } from '@/lib/chain'
import { formatUsdcDisplay, isUserRejection, parseOnchainError, shortAddress } from '@/lib/format'
import { useFeeEstimate, useFeeEstimator } from '@/hooks/useFeeEstimate'
import { Amount, parseAmount } from '@/onchain-money'
import { TxStatus, type SendSnapshot } from './TxStatus'

interface Props {
  balance: Amount | undefined
  refetchBalance: () => void
}

const FALLBACK_FEE_RESERVE = 50_000n // 0.05 USDC, used only when a live fee estimate is unavailable
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function initialParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

export function SendCard({ balance, refetchBalance }: Props) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const queryClient = useQueryClient()
  const estimateFee = useFeeEstimator()

  const [to, setTo] = useState(() => initialParam('to'))
  const [amount, setAmount] = useState(() => initialParam('amount'))
  const [snapshot, setSnapshot] = useState<SendSnapshot | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const { writeContract, isPending, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash: snapshot?.hash, chainId: TARGET_CHAIN_ID })

  const recipient = to.trim()
  const recipientValid = isAddress(recipient) && recipient.toLowerCase() !== ZERO_ADDRESS
  const isSelf = recipientValid && address !== undefined && recipient.toLowerCase() === address.toLowerCase()

  const parsed = useMemo(() => {
    if (!amount) return { value: null, error: null as string | null }
    try {
      return { value: parseAmount(TARGET_CHAIN_ID, amount), error: null }
    } catch {
      return { value: null, error: 'Enter a valid amount (up to 6 decimals).' }
    }
  }, [amount])

  const value = parsed.value
  const overBalance = value !== null && balance !== undefined && value.gt(balance)
  const feeQuery = useFeeEstimate(
    recipientValid ? (recipient) : undefined,
    value && value.isPositive() && !overBalance ? value.raw : undefined,
  )
  const fee = feeQuery.data
  const cannotCoverFee = value !== null && balance !== undefined && fee !== undefined && !overBalance && value.add(fee).gt(balance)

  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID
  const receiptStatus = receipt.data?.status

  // Refresh balance and history once the transfer is confirmed.
  const confirmedHash = receipt.isSuccess && receiptStatus === 'success' ? snapshot?.hash : undefined
  useEffect(() => {
    if (!confirmedHash) return
    toast.success('USDC sent')
    refetchBalance()
    void queryClient.invalidateQueries({ queryKey: ['activity'] })
    // The explorer indexes a few seconds behind the chain.
    const timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['activity'] }), 6000)
    return () => clearTimeout(timer)
  }, [confirmedHash, queryClient, refetchBalance])

  const blocker: string | null = !recipient
    ? 'Enter a recipient'
    : !recipientValid
      ? 'Recipient is not a valid address'
      : isSelf
        ? 'Choose an address other than your own'
        : !amount
          ? 'Enter an amount'
          : parsed.error
            ? parsed.error
            : value?.isZero()
              ? 'Amount must be above zero'
              : overBalance
                ? 'Amount exceeds your balance'
                : cannotCoverFee
                  ? 'Not enough left to cover the network fee'
                  : null

  const inFlight = isPending || (snapshot !== null && receipt.isLoading)

  const onMax = async () => {
    if (!balance || !address) return
    const probe = (recipientValid ? recipient : address)
    let reserve = FALLBACK_FEE_RESERVE
    try {
      // Doubled so the fee cannot outgrow the reserve before the transfer lands.
      reserve = (await estimateFee(probe, 1n)).raw * 2n
    } catch {
      /* keep the fallback reserve */
    }
    const max = balance.raw > reserve ? balance.raw - reserve : 0n
    setAmount(Amount.fromRaw(max, balance.decimals).toString())
  }

  const onSubmit = () => {
    if (wrongChain) {
      switchChain({ chainId: TARGET_CHAIN_ID })
      return
    }
    if (blocker || !value) return
    setSendError(null)
    setSnapshot(null)
    writeContract(
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, value.raw],
        chainId: TARGET_CHAIN_ID,
      },
      {
        onSuccess: (hash) => {
          setSnapshot({ hash, to: recipient, amount: value.toString() })
          // Hand the hash to the backend so the transfer is followed even if this tab closes.
          if (address) {
            void api
              .trackTransfer({ hash, wallet: address })
              .then(() => queryClient.invalidateQueries({ queryKey: ['transfers'] }))
              .catch(() => undefined)
          }
          setAmount('')
          setTo('')
        },
        onError: (error) => {
          // Cancelling in the wallet is a choice, not a failure.
          if (isUserRejection(error)) {
            toast('Transaction cancelled')
            return
          }
          setSendError(parseOnchainError(error))
        },
      },
    )
  }

  const dismiss = () => {
    setSnapshot(null)
    setSendError(null)
    reset()
  }

  const label = !isConnected
    ? 'Connect wallet'
    : wrongChain
      ? switching
        ? 'Switching…'
        : `Switch to ${chainFacts.name}`
      : (blocker ?? `Send ${amount} USDC`)

  return (
    <section className="glass-card relative overflow-hidden rounded-3xl">
      <div className="spectral-strip h-1" />
      <div className="p-5">
        <h2 className="display mb-4 text-lg font-semibold">Send USDC</h2>

        <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--muted)' }} htmlFor="recipient">
          Recipient
        </label>
        <div className="field glass-inner mb-4 rounded-2xl px-4 py-3 transition-shadow">
          <input
            id="recipient"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="mono w-full bg-transparent text-sm outline-none placeholder:text-slate-300"
            style={{ color: 'var(--ink)' }}
          />
        </div>

        <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--muted)' }} htmlFor="amount">
          Amount
        </label>
        <div className="field glass-inner rounded-2xl p-4 transition-shadow">
          <input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const next = e.target.value.replace(/[^0-9.]/g, '')
              if (/^\d*\.?\d*$/.test(next)) setAmount(next)
            }}
            placeholder="0.00"
            className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300"
            style={{ color: 'var(--ink)' }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
            <button
              onClick={() => void onMax()}
              disabled={!balance}
              className="min-h-8 text-xs font-semibold disabled:opacity-40"
              style={{ color: 'var(--accent-hover)' }}
            >
              {balance ? `Balance ${formatUsdcDisplay(balance, 2)} · Max` : 'Balance unavailable'}
            </button>
          </div>
        </div>

        {recipientValid && value?.isPositive() && !overBalance && (
          <dl className="mt-4 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt style={{ color: 'var(--muted)' }}>To</dt>
              <dd className="mono" style={{ color: 'var(--ink-2)' }}>
                {shortAddress(recipient)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--muted)' }}>Network fee (paid in USDC)</dt>
              <dd className="tabular-nums" style={{ color: 'var(--ink-2)' }}>
                {fee ? (fee.raw === 0n ? '< 0.000001' : `~${fee.toFixed(6)}`) : feeQuery.isError ? 'Estimate unavailable' : 'Estimating…'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--muted)' }}>Network</dt>
              <dd style={{ color: 'var(--ink-2)' }}>{chainFacts.name}</dd>
            </div>
          </dl>
        )}

        <button
          onClick={onSubmit}
          disabled={!isConnected || inFlight || (!wrongChain && blocker !== null)}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Confirm in wallet…
            </>
          ) : snapshot !== null && receipt.isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Confirming…
            </>
          ) : (
            <>
              {!blocker && !wrongChain && <SendHorizontal className="size-4" aria-hidden />}
              {label}
            </>
          )}
        </button>

        <TxStatus
          awaitingWallet={isPending}
          snapshot={snapshot}
          receipt={{
            isLoading: receipt.isLoading,
            isSuccess: receipt.isSuccess,
            isError: receipt.isError,
            status: receiptStatus,
            blockNumber: receipt.data?.blockNumber,
          }}
          error={sendError}
          onDismiss={dismiss}
        />
      </div>
    </section>
  )
}
