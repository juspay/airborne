import { useState } from "react";
import RequestSuccessImage from "../../assets/request-success.svg"; // Import your success image
import { Plus } from "lucide-react";
import axios from "../../api/axios";
import { useToast } from "../../utils/useToast";

export default function RequestAccess({}) {
  const [newOrgName, setNewOrgName] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [appStoreLink, setAppStoreLink] = useState<string>("");
  const [playStoreLink, setPlayStoreLink] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertState, setAlertState] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const onCancel = () => {
    setIsModalOpen(false);
    setAlertState(0);
    setErrorMessage("");
  };

  const { showSuccess, showError } = useToast();

  const onCreate = async() => {
    setIsSubmitting(true);
    try{
      await axios.post("/organisations/request-access", {
        organisation_name: newOrgName,
        name,
        email,
        phoneNumber,
        app_store_link: appStoreLink,
        play_store_link: playStoreLink,
      });
      
      showSuccess("Organization request submitted successfully");
      setAlertState(1); 
      setIsModalOpen(false);

    }
    catch(err){
      console.error("Failed to request organization:", err);
      setErrorMessage("Failed to request organization");
      setAlertState(2);
      showError("Failed to request organization");
    }
    finally{
      setIsSubmitting(false);
    }
  };

  if (!isModalOpen) {
    <button
      onClick={() => setIsModalOpen(true)}
      className="w-full p-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 group"
    >
      <div className="flex items-center justify-center space-x-2">
        <Plus
          size={24}
          className="group-hover:rotate-90 transition-transform duration-300"
        />
        <span>Request to Create Organization</span>
      </div>
    </button>;
  }

  return (
    <div className="bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl border border-slate-700/50 max-w-lg mx-auto font-sans">
      <h2 className="text-2xl font-semibold mb-6 text-slate-100">
        Request for your first organisation
      </h2>
      <div className="space-y-6">
        {alertState === 2 && (
          <div className="text-center py-4 lg:px-4">
            <div
              className="py-4 px-8 bg-red-800 items-center text-red-100 leading-none lg:rounded-full flex lg:inline-flex"
              role="alert"
            >
              <span className=" mr-2 text-left flex-auto">{errorMessage}</span>
            </div>
          </div>
        )}
        {alertState === 1 && (
          <div className="text-center py-4 lg:px-4">
            <img
              src={RequestSuccessImage}
              alt="Success"
              className="w-full mx-auto mb-4"
            />
            <div
              className="py-4 px-8 bg-indigo-800 items-center text-indigo-100 leading-none lg:rounded-full flex lg:inline-flex"
              role="alert"
            >
              <span className=" mr-2 text-left flex-auto">
                We have received your request for new organisation, someone from
                our team will connect with you soon 😊
              </span>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="mt-10 ml-2 w-full sm:w-auto flex justify-center py-2.5 px-4 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500"
              >
                Close
              </button>
            )}
          </div>
        )}
        {alertState !== 1 && (
          <>
            <div>
              <label
                htmlFor="orgName"
                className="block text-sm font-medium text-slate-300 mb-1"
              >
                Organisation Name
              </label>
              <input
                id="orgName"
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Enter organisation name"
                className="appearance-none block w-full px-4 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="yourName"
                className="block text-sm font-medium text-slate-300 mb-1"
              >
                Your Name
              </label>
              <input
                id="yourName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="appearance-none block w-full px-4 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="appearance-none block w-full px-4 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-slate-300 mb-1"
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter your phone number"
                className="appearance-none block w-full px-4 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="appStoreLink"
                className="block text-sm font-medium text-slate-300 mb-1"
              >
                App Store Link
              </label>
              <input
                id="appStoreLink"
                type="text"
                value={appStoreLink}
                onChange={(e) => setAppStoreLink(e.target.value)}
                placeholder="Enter Apple App Store link"
                className="appearance-none block w-full px-4 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="playStoreLink"
                className="block text-sm font-medium text-slate-300 mb-1"
              >
                Play Store Link
              </label>
              <input
                id="playStoreLink"
                type="text"
                value={playStoreLink}
                onChange={(e) => setPlayStoreLink(e.target.value)}
                placeholder="Enter Google Play Store link"
                className="appearance-none block w-full px-4 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full sm:w-auto flex justify-center py-2.5 px-4 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={onCreate}
                disabled={!newOrgName.trim() || isSubmitting}
                className={`w-full sm:flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  newOrgName.trim()
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500"
                    : "bg-slate-600 text-slate-400 cursor-not-allowed"
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-70`}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
