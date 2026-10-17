import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAF8] text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
