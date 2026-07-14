import { useNavigate } from "react-router-dom";
import { Users, ArrowRight, Shield, UserPlus, Settings } from "lucide-react";

const AddUser = () => {
  const navigate = useNavigate();

  const handleManageUsers = () => {
    navigate("/admin/users");
  };

  return (
    <div className="space-y-6">
      {/* Main Card */}
      <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8">
          {/* Header Section */}
          <div className="flex items-start gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                User Management
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Add, edit, and manage users who have access to your CRM system.
                Control permissions and monitor user activity.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="bg-green-100 p-2 rounded-lg w-fit mb-3">
                <UserPlus className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                Add Users
              </h3>
              <p className="text-xs text-gray-600">
                Invite team members to collaborate
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="bg-purple-100 p-2 rounded-lg w-fit mb-3">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                Set Permissions
              </h3>
              <p className="text-xs text-gray-600">
                Control access levels and roles
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="bg-blue-100 p-2 rounded-lg w-fit mb-3">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                Manage Teams
              </h3>
              <p className="text-xs text-gray-600">
                Organize users into teams
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              onClick={handleManageUsers}
              className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Users className="w-5 h-5" />
              Manage Users
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1 text-sm">
                Role-Based Access
              </h3>
              <p className="text-xs text-blue-700 leading-relaxed">
                Assign different roles to users: Admin, Manager, or Staff with
                customized permissions for each role.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <UserPlus className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 mb-1 text-sm">
                Easy Onboarding
              </h3>
              <p className="text-xs text-purple-700 leading-relaxed">
                Send invitation emails to new users. They can set up their
                account with a secure password.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddUser;
