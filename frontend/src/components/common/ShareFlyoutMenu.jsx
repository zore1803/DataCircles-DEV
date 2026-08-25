import React, { useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Mail, MessageSquare, Copy } from "lucide-react";
import toast from "react-hot-toast";

// Reusable "Share via WhatsApp/Email/SMS" flyout, generalized from
// Accounting.jsx's inline share dropdown (row-actions menu -> Share ->
// this) so Purchase/Purchase Order can reuse the exact same behavior:
// WhatsApp opens wa.me client-side, Email/SMS hand off to the caller's
// compose modal (prefilled), Copy Link copies the public /view/:type/:id
// link. Saved org templates ({customerName}/{docType}/{number}/{amount}/
// {link}/{company} placeholders) are used when present, same as Accounting;
// falls back to a sensible built-in message otherwise.
export default function ShareFlyoutMenu({
  x,
  y,
  onClose,
  link,
  docTypeLabel,
  docNumber,
  recipientName,
  recipientEmail,
  recipientPhone,
  amountLabel,
  companyName,
  waTemplates = [],
  emailTemplates = [],
  smsTemplates = [],
  onOpenEmail,
  onOpenSms,
}) {
  const [channel, setChannel] = useState(null);

  const fillTpl = (tpl) =>
    (tpl || "")
      .replace(/{customerName}/g, recipientName || "")
      .replace(/{docType}/g, docTypeLabel)
      .replace(/{number}/g, docNumber || "—")
      .replace(/{amount}/g, amountLabel || "")
      .replace(/{link}/g, link)
      .replace(/{company}/g, companyName || "");

  const buildWaMsg = (tpl) =>
    `Hello! *${recipientName || ""}*\n\n${tpl?.line1 || "Your " + docTypeLabel + " is ready to view."}\n\nDocument No: ${docNumber || "—"}\nTotal: ${amountLabel || ""}\nLink: ${link}${tpl?.line2 ? `\n\n${tpl.line2}` : ""}\n\nThanks\n*${companyName || "our team"}*`;
  const buildSmsMsg = (tpl) =>
    tpl?.body
      ? fillTpl(tpl.body)
      : `Your ${docTypeLabel}${docNumber ? ` #${docNumber}` : ""} is ready. View & Download: ${link}`;
  const buildEmailSubject = (tpl) => (tpl?.subject ? fillTpl(tpl.subject) : `${docTypeLabel} ${docNumber || ""}`);
  const buildEmailBody = (tpl) =>
    tpl?.body
      ? fillTpl(tpl.body)
      : `Hi ${recipientName || ""},\n\nPlease find attached your ${docTypeLabel}${docNumber ? ` #${docNumber}` : ""}.\n\nYou can also view it online: ${link}\n\nThank you for your business!`;

  const channels = {
    whatsapp: {
      list: waTemplates,
      send: (tpl) => {
        window.open(`https://wa.me/?text=${encodeURIComponent(buildWaMsg(tpl))}`, "_blank");
        onClose();
      },
    },
    email: {
      list: emailTemplates,
      send: (tpl) => {
        onOpenEmail?.({
          to: recipientEmail || "",
          subject: buildEmailSubject(tpl),
          body: buildEmailBody(tpl),
        });
        onClose();
      },
    },
    sms: {
      list: smsTemplates,
      send: (tpl) => {
        onOpenSms?.({
          to: recipientPhone || "",
          body: buildSmsMsg(tpl),
        });
        onClose();
      },
    },
  };

  // 0 or 1 saved template -> send straight away; 2+ -> let the user pick.
  const openChannel = (name) => {
    const { list, send } = channels[name];
    if (list.length <= 1) send(list[0] || null);
    else setChannel(name);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Link copied");
    onClose();
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100009]" onClick={onClose} />
      <div
        className="fixed z-[100010] bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-52"
        style={{ top: y, left: x }}
      >
        {channel ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setChannel(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 border-b border-gray-100"
            >
              ← Back
            </button>
            {channels[channel].list.map((tpl) => (
              <button
                key={tpl.id}
                onClick={(e) => {
                  e.stopPropagation();
                  channels[channel].send(tpl);
                }}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="truncate">{tpl.name}</span>
                {tpl.isDefault && (
                  <span className="text-[10px] text-green-600 font-semibold flex-shrink-0">Default</span>
                )}
              </button>
            ))}
          </>
        ) : (
          [
            { label: "WhatsApp", icon: <MessageCircle className="w-4 h-4 text-green-600" />, onClick: () => openChannel("whatsapp") },
            { label: "Email", icon: <Mail className="w-4 h-4 text-blue-600" />, onClick: () => openChannel("email") },
            { label: "SMS", icon: <MessageSquare className="w-4 h-4 text-purple-600" />, onClick: () => openChannel("sms") },
            { label: "Copy Link", icon: <Copy className="w-4 h-4 text-gray-500" />, onClick: copyLink },
          ].map(({ label, icon, onClick }) => (
            <button
              key={label}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {icon}
              {label}
            </button>
          ))
        )}
      </div>
    </>,
    document.body
  );
}
