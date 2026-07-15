// components/subscription/FeatureComparisonTable.jsx
import React from 'react';
import { Check, X } from 'lucide-react';

// Rows we always want to show, in this order
// Each entry maps a display label → how to get the value from plan.limits or plan.modules
//
// Note: the old 'Website Forms' row (plan.limits.websiteForms) was removed here — Forms is now
// a first-class plan-gated module (plan.modules.forms, in MODULE_ROWS below), which shows the
// same limit number plus the real enforcement it's actually gated by. The underlying
// `websiteForms` field still exists on PlanConfig (unused, display-only elsewhere) — left alone,
// not part of this change; a future Billing cleanup pass can remove it.
const LIMIT_ROWS = [
  { label: 'Email Templates',  key: 'emailTemplates' },
  { label: 'Sales Pipelines',  key: 'salesPipelines'  },
  { label: 'Custom Fields',    key: 'customFields'    },
  { label: 'Record Tags',      key: 'recordTags'      },
  {
    label: 'File Storage',
    key: 'fileStorage',
    format: (v) => `${Math.round(v / (1024 * 1024 * 1024))} GB`,
  },
];

const BOOLEAN_ROWS = [
  { label: 'Rotten Deals',      key: 'rottenDeals'      },
  { label: 'Advanced Reports',  key: 'advancedReports'  },
];

// Modules we always want to display on/off status for
const MODULE_ROWS = [
  { label: 'Contacts',          mod: 'contacts'           },
  { label: 'Companies',         mod: 'companies'          },
  { label: 'Deals',             mod: 'deals'              },
  { label: 'Vendors',           mod: 'vendors'            },
  { label: 'Invoices',          mod: 'invoices'           },
  { label: 'Quotations',        mod: 'quotations'         },
  { label: 'Delivery Challans', mod: 'delivery-challans'  },
  { label: 'Tasks',             mod: 'tasks'              },
  { label: 'Call Logs',         mod: 'callLogs'           },
  { label: 'Meetings',          mod: 'meetings'           },
  { label: 'Purchases',         mod: 'purchases'          },
  { label: 'Emails',            mod: 'emails'             },
  { label: 'Folders',           mod: 'folders'            },
  { label: 'Forms',             mod: 'forms'              },
];

const Tick = () => <Check className="w-4 h-4 text-green-600 mx-auto" />;
const Cross = () => <X className="w-4 h-4 text-red-400 mx-auto" />;

const formatLimit = (val, format) => {
  if (val === undefined || val === null) return '—';
  if (format) return format(val);
  if (typeof val === 'number') return val.toLocaleString('en-IN');
  return String(val);
};

const FeatureComparisonTable = ({ plans = [] }) => {
  // Filter out trial plan for the comparison table (it mirrors growth)
  const displayPlans = plans.filter((p) => p.planId !== 'trial');

  // Fallback: if no plans yet (still loading), show nothing
  if (displayPlans.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Detailed Feature Comparison</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                Feature
              </th>
              {displayPlans.map((p) => (
                <th key={p.planId} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {/* Numeric limits */}
            {LIMIT_ROWS.map(({ label, key, format }, i) => (
              <tr key={label} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="px-6 py-3 text-sm text-gray-700">{label}</td>
                {displayPlans.map((p) => (
                  <td key={p.planId} className="px-6 py-3 text-sm text-center text-gray-800 font-medium">
                    {formatLimit(p.limits?.[key], format)}
                  </td>
                ))}
              </tr>
            ))}

            {/* Boolean feature flags */}
            {BOOLEAN_ROWS.map(({ label, key }, i) => (
              <tr key={label} className={(LIMIT_ROWS.length + i) % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="px-6 py-3 text-sm text-gray-700">{label}</td>
                {displayPlans.map((p) => (
                  <td key={p.planId} className="px-6 py-3 text-center">
                    {p.limits?.[key] ? <Tick /> : <Cross />}
                  </td>
                ))}
              </tr>
            ))}

            {/* Module on/off */}
            <tr>
              <td colSpan={displayPlans.length + 1} className="px-6 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-100">
                Module Access
              </td>
            </tr>
            {MODULE_ROWS.map(({ label, mod }, i) => (
              <tr key={mod} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="px-6 py-3 text-sm text-gray-700">{label}</td>
                {displayPlans.map((p) => {
                  const cfg = p.modules?.[mod];
                  const on = cfg?.read || cfg?.write;
                  // If module has a numeric limit, show the number instead of just a tick
                  const hasLimit = cfg?.limit !== undefined;
                  const limitVal = cfg?.limit;
                  return (
                    <td key={p.planId} className="px-6 py-3 text-sm text-center">
                      {!on ? (
                        <Cross />
                      ) : hasLimit ? (
                        <span className="text-gray-800 font-medium">
                          {limitVal === 'unlimited' ? '∞' : Number(limitVal).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <Tick />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeatureComparisonTable;