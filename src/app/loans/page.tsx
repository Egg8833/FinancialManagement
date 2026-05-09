"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoansRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/staking'); }, [router]);
  return null;
}
