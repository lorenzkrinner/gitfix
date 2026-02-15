"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { CheckIcon } from "lucide-react";
import { api } from "~/trpc/react";
import { Item, ItemContent, ItemDescription, ItemHeader, ItemMedia } from "~/components/ui/item";
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { Spinner } from "~/components/ui/spinner";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import Image from "next/image";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { CONTACT_EMAIL } from "~/lib/constants/global";


const benefitsDeposit = [
  "Early access",
  "Occasional updates",
  "Skip waitlist queue",
  "20% off your first 3 months",
];

const benefitsFree = ["Early access", "Occasional updates"];

type Option = "deposit" | "free";

export default function WaitlistDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<Option>("free");
  const [freeSuccess, setFreeSuccess] = useState(false);
  const [alreadyOnList, setAlreadyOnList] = useState(false);

  const deposit = api.waitlist.deposit.useMutation({
    onMutate: () => {
      setError(null);
      setAlreadyOnList(false);
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        setError("This email already has a deposit.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    },
  });

  const join = api.waitlist.join.useMutation({
    onMutate: () => {
      setError(null);
      setAlreadyOnList(false);
    },
    onSuccess: () => {
      setFreeSuccess(true);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        setAlreadyOnList(true);
        setError(null);
      } else {
        setError("Something went wrong. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedOption === "deposit") {
      deposit.mutate({ email });
    } else {
      join.mutate({ email });
    }
  };

  const isPending = deposit.isPending || join.isPending;
  const isDepositOnlyBenefit = (benefit: string) =>
    selectedOption === "free" && !benefitsFree.includes(benefit);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="min-w-3xl w-full flex gap-0 p-0">
        <div className="flex flex-col gap-6 p-8 w-2/3">
          <DialogHeader className="p-0">
            <DialogTitle className="text-xl leading-4">{freeSuccess ? "Optional Upgrade" : "Join the waitlist"}</DialogTitle>
            <DialogDescription>
              {freeSuccess ? "Leave a deposit to get access to exclusive benefits" : "Join to secure your spot for early access."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex w-full gap-6">
            <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-col gap-4 w-full">
            {freeSuccess ? (
                <p className="text-sm text-primary font-medium">You&apos;re on the list. Optionally upgrade below.</p>
              ) : (
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setAlreadyOnList(false);
                  }}
                  required
                  disabled={freeSuccess}
                />
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {alreadyOnList && (
                <p className="text-sm text-destructive">
                  You&apos;re already on the list but can optionally leave a deposit.
                </p>
              )}
              {!alreadyOnList && !freeSuccess && (
                <p className="text-sm text-muted-foreground -mb-2">Optional upgrade</p>
              )}
              <Item
                variant="outline"
                className={`cursor-pointer p-3 ${selectedOption === "deposit" ? "border-primary" : ""}`}
                onClick={() => setSelectedOption(selectedOption === "deposit" ? "free" : "deposit")}
              >
                <ItemContent>
                  <ItemHeader>Waitlist Deposit</ItemHeader>
                  <ItemDescription>
                    <span className="text-sm text-foreground">$5</span>
                    {" "}
                    one time
                    <Badge variant="secondary" className="ml-2 bg-muted text-foreground">Limited time</Badge>
                  </ItemDescription>
                </ItemContent>
                <ItemMedia>
                  {selectedOption === "deposit" && (
                    <CheckCircleIcon className="text-primary size-6" />
                  )}
                </ItemMedia>
              </Item>
              {selectedOption === "deposit" && (
                <>
                  <Separator className="my-3" />
                  <div className="flex flex-col w-full gap-3">
                    <div className="flex w-full items-center justify-between">
                      <p className="text-sm">Due today</p>
                      <p className="text-sm text-muted-foreground">$5</p>
                    </div>
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Image
                          src="/icons/starbucks.svg"
                          alt="Starbucks venti"
                          width={20}
                          height={20}
                          className="rounded-sm"
                        />
                        <p className="text-sm">Price of a Starbucks venti</p>
                      </div>
                      <p className="text-sm text-muted-foreground">$6</p>
                    </div>
                  </div>
                  <Button type="submit" disabled={isPending || !email}>
                    {isPending ? (
                      <Spinner />
                    ) : (
                      "Upgrade for less than a Coffee"
                    )}
                  </Button>
                  <p className="text-xs text-primary">Your deposit is refundable up until we launch.</p>
                </>
              )}
              {selectedOption === "free" && (
                <Button type="submit" disabled={isPending || !email || freeSuccess}>
                  {isPending ? <Spinner /> : <span>Join waitlist for free</span>}
                </Button>
              )}
              <p className={cn("text-xs text-muted-foreground", selectedOption === "deposit" && "-mt-2")}>Your email: {email}</p>
            </form>
          </div>
        </div>
        <div className="p-8 flex flex-col justify-between w-1/3 bg-muted/80">
          <div className="flex flex-1 flex-col gap-3">
            <h3 className="font-semibold">What you get</h3>
            <ul className="flex flex-col gap-2">
              {benefitsDeposit.map((item) => {
                const grayedOut = isDepositOnlyBenefit(item);
                return (
                  <li
                    key={item}
                    className={`flex items-center gap-2 text-sm ${grayedOut ? "text-muted-foreground/50 opacity-60" : "text-muted-foreground"}`}
                  >
                    <CheckIcon className={`size-4 shrink-0 ${grayedOut ? "text-muted-foreground/50" : "text-muted-foreground"}`} />
                    <span>{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">Issues? Contact <Link href={`mailto:${CONTACT_EMAIL}`} className="text-primary">{CONTACT_EMAIL}</Link></p>
        </div>
      </DialogContent>
    </Dialog>
  );
}