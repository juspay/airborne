import { useState } from "react";
import RequestSuccessImage from "../../assets/request-success.svg"; // Import your success image

interface CreateOrganizationProps {
  newOrgName: string;
  name: string;
  email: string;
  phoneNumber: string;
  appStoreLink: string;
  playStoreLink: string;
  onOrgNameChange: (name: string) => void;
  onNameChange: (name: string) => void;
  onEmailChange: (name: string) => void;
  onPhoneNumberChange: (name: string) => void;
  onAppStoreLinkChange: (name: string) => void;
  onPlayStoreLinkChange: (name: string) => void;
  onCreateOrg: (successCb: () => void, errorCb: (message) => void) => void;
  onCancel?: () => void; // Optional: Add onCancel if you want a cancel button
}

export default function RequestAccess({
  newOrgName,
  name,
  email,
  phoneNumber,
  appStoreLink,
  playStoreLink,
  onOrgNameChange,
  onNameChange,
  onEmailChange,
  onPhoneNumberChange,
  onAppStoreLinkChange,
  onPlayStoreLinkChange,
  onCreateOrg,
  onCancel, 
}: CreateOrganizationProps) {
  const [alertState, setAlertState] = useState(0); // 0: no alert, 1: success, 2: error
  const [errorMessage, setErrorMessage] = useState("");
  let successCb = () => {
    console.log("success callback called");
    setAlertState(1);
  }
  let errorCb = (message: string) => {
    setAlertState(2);
    console.log("error callback called");
    setErrorMessage(message);
  };
  return (
    <div className="bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl border border-slate-700/50 max-w-lg mx-auto font-sans">
      <h2 className="text-2xl font-semibold mb-6 text-slate-100">
        Request for your first organisation
      </h2>
      <div className="space-y-6">
        {alertState === 2 && (
          <div className="text-center py-4 lg:px-4">
            <div className="py-4 px-8 bg-red-800 items-center text-red-100 leading-none lg:rounded-full flex lg:inline-flex" role="alert">
              <span className=" mr-2 text-left flex-auto">{errorMessage}</span>
            </div>
          </div>
        )}
        {alertState === 1 && (
        <div className="text-center py-4 lg:px-4">
          <img src={RequestSuccessImage} alt="Success" className="w-full mx-auto mb-4" />
          <div className="py-4 px-8 bg-indigo-800 items-center text-indigo-100 leading-none lg:rounded-full flex lg:inline-flex" role="alert">
            <span className=" mr-2 text-left flex-auto">We have received your request for new organisation, someone from our team will connect with you soon 😊</span>
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
                onChange={(e) => onOrgNameChange(e.target.value)}
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
                onChange={(e) => onNameChange(e.target.value)}
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
                onChange={(e) => onEmailChange(e.target.value)}
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
                onChange={(e) => onPhoneNumberChange(e.target.value)}
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
                onChange={(e) => onAppStoreLinkChange(e.target.value)}
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
                onChange={(e) => onPlayStoreLinkChange(e.target.value)}
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
                onClick={() => onCreateOrg(successCb, errorCb)}
                disabled={!newOrgName.trim()}
                className={`w-full sm:flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  newOrgName.trim()
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500"
                    : "bg-slate-600 text-slate-400 cursor-not-allowed"
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-70`}
              >
                Submit
              </button>
            </div>
          </>
        )}
        
      </div>
    </div>
  );
}
