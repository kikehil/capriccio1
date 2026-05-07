'use client';

import dynamic from 'next/dynamic';

const DeliveryDashboard = dynamic(
    () => import('@/components/delivery/DeliveryDashboard'),
    { ssr: false }
);

export default function RepartidorPage() {
    return (
        <div className="bg-[#f0f2f5] min-h-screen">
            <DeliveryDashboard />
        </div>
    );
}
