// Inline SVG icons for the shopping module, and the section nav that uses them.
import React from 'react';

const IconMic      = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="6" y="1" width="6" height="9" rx="3"/><path d="M3 10a6 6 0 0 0 12 0"/><line x1="9" y1="16" x2="9" y2="18"/></svg>;
const IconPlus     = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>;
const IconMinus    = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="5" x2="9" y2="5"/></svg>;
const IconX        = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>;
const IconCheck    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 7 6 11 12 3"/></svg>;
const IconPencil   = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M9 1.5L11.5 4l-7 7H2V8.5l7-7z"/></svg>;
const IconTrash    = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="1.5" y1="3.5" x2="11.5" y2="3.5"/><path d="M4.5 3.5V2.5h4v1"/><path d="M2.5 3.5l.7 7.5h6.6l.7-7.5"/></svg>;
const IconCart     = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h2.5l2.5 9h8.5l1.5-5.5H5"/><circle cx="8" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="15.5" r="1.5" fill="currentColor" stroke="none"/></svg>;
const IconLocation = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="5" r="2"/><path d="M6 1a4 4 0 0 1 4 4c0 3-4 7-4 7S2 8 2 5a4 4 0 0 1 4-4z"/></svg>;
const IconChevron  = ({ up }) => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points={up ? '1.5 7 5 3 8.5 7' : '1.5 3 5 7 8.5 3'}/></svg>;
const IconShare    = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="2" r="1.5"/><circle cx="10" cy="11" r="1.5"/><circle cx="2.5" cy="6.5" r="1.5"/><line x1="4" y1="5.8" x2="8.6" y2="2.9"/><line x1="4" y1="7.2" x2="8.6" y2="10.1"/></svg>;
const IconLink     = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7a3 3 0 0 0 4.5.4l1.5-1.5a3 3 0 0 0-4.2-4.2L5.6 2.9"/><path d="M8 6a3 3 0 0 0-4.5-.4L2 7.1a3 3 0 0 0 4.2 4.2l1.1-1.1"/></svg>;
const IconSparkle  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 1l1.2 4 4 1.2-4 1.2L7 11.5l-1.2-4L1.8 6.2l4-1.2z"/></svg>;
const IconCalendar = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="1" y="2.5" width="12" height="10.5" rx="1.5"/><path d="M1 6h12"/><line x1="4.5" y1="1" x2="4.5" y2="4"/><line x1="9.5" y1="1" x2="9.5" y2="4"/></svg>;
const IconNavigation = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4.5h10M8 1.5l3 3-3 3"/><path d="M14 10.5H4M7 7.5l-3 3 3 3"/></svg>;
const IconBarcode  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 3v12M5 3v12M7.5 3v12M10 3v12M11.5 3v12M14 3v12M16 3v12"/></svg>;
const IconBarcodeSm = () => <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 3v12M5 3v12M7.5 3v12M10 3v12M11.5 3v12M14 3v12M16 3v12"/></svg>;
// Nav panel icons
const IconNavCart  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h2.5l2.5 9h8.5l1.5-5.5H5"/><circle cx="8" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="15.5" r="1.5" fill="currentColor" stroke="none"/></svg>;
const IconNavBook  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3.5h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H3V3.5z"/><path d="M15 3.5h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5V3.5z"/></svg>;
const IconNavWallet= () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="1" y="4" width="16" height="12" rx="2"/><path d="M1 8.5h16"/><circle cx="13.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M5 4V3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/></svg>;
const IconNavBox   = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6.5l6-4 6 4v8l-6 4-6-4v-8z"/><line x1="9" y1="2.5" x2="9" y2="18"/><path d="M3 6.5l6 4 6-4"/></svg>;
const IconNavStore = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h14"/><path d="M3 3h12l2 5H1L3 3z"/><path d="M6 8v9"/><path d="M12 8v9"/><path d="M1 17h16"/></svg>;
// Recipe mode icons
const IconClock    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="6"/><path d="M7 3.5V7l2.5 1.5"/></svg>;
const IconServings = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="4" r="2"/><path d="M1 13c0-2.5 1.8-4 4-4s4 1.5 4 4"/><circle cx="10.4" cy="5" r="1.5"/><path d="M8.6 9.2c1.9.3 3.2 1.7 3.2 3.8"/></svg>;
const IconCamera   = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5A1.5 1.5 0 0 1 3.5 5h2l1-1.5h7L14.5 5h2A1.5 1.5 0 0 1 18 6.5v8A1.5 1.5 0 0 1 16.5 16h-13A1.5 1.5 0 0 1 2 14.5v-8z"/><circle cx="10" cy="10.5" r="3.2"/></svg>;
const IconBook     = () => <svg width="26" height="26" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3.5h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H3V3.5z"/><path d="M15 3.5h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5V3.5z"/></svg>;

const NAV = [
  { id: 'lists',   label: 'My List',          Icon: IconNavCart   },
  { id: 'recipes', label: 'Recipes',          Icon: IconNavBook   },
  { id: 'budget',  label: 'Monthly Budget',   Icon: IconNavWallet, short: 'Budget' },
  { id: 'items',   label: 'Items',            Icon: IconNavBox    },
  { id: 'stores',  label: 'Stores',           Icon: IconNavStore  },
];

export {
  IconMic, IconPlus, IconMinus, IconX, IconCheck, IconPencil, IconTrash,
  IconCart, IconLocation, IconChevron, IconShare, IconLink, IconSparkle,
  IconCalendar, IconNavigation, IconBarcode, IconBarcodeSm,
  IconNavCart, IconNavBook, IconNavWallet, IconNavBox, IconNavStore,
  IconClock, IconServings, IconCamera, IconBook,
  NAV,
};
