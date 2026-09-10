import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

export default function UserRegister() {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#EAEAEA] p-2 font-inter sm:p-4">
      <div className="flex h-full w-full flex-col items-stretch gap-4 lg:flex-row">

        {/* LEFT SECTION — hidden on mobile */}
        <div className="relative hidden h-full w-[46%] shrink-0 overflow-hidden rounded-[18px] bg-white lg:block">
          <img src="/Ellipse 2.png" alt="" className="absolute left-0 -top-40 z-10 h-auto w-full object-contain" />
          <img src="/Ellipse 1.png" alt="" className="absolute left-0 z-10 h-[120%] w-full object-contain" />
          <div className="absolute bottom-[32px] left-1/2 z-20 mb-20 h-[286px] w-[448px] -translate-x-1/2">
            <div className="absolute left-[178px] top-0 flex h-[92px] w-[92px] items-center justify-center rounded-[16px] bg-[#0085FF]">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M20 10C15.0294 10 11 14.0294 11 19V31.0498C11 31.5743 10.5743 32 10.0498 32C9.798 31.9999 9.557 31.8997 9.3789 31.7217L0 22.3428V26.585L7.2578 33.8428C7.9984 34.5834 9.002 34.9999 10.0498 35C12.2312 35 14 33.2312 14 31.0498V19C14 15.6863 16.6863 13 20 13C23.3137 13 26 15.6863 26 19V31.0498C26 33.2312 27.7688 35 29.9502 35C30.998 34.9999 32.0016 34.5834 32.7422 33.8428L34.707 31.8785L37.707 28.8785L40 26.585V22.3428L37.8789 24.4639L35.585 26.7574L32.585 29.7574L30.6211 31.7217C30.443 31.8997 30.202 31.9999 29.9502 32C29.4257 32 29 31.5743 29 31.0498V19C29 14.0294 24.9706 10 20 10ZM20 15C17.7909 15 16 16.7909 16 19V31.0498C16 34.3358 13.3358 37 10.0498 37C8.472 36.9999 6.958 36.3735 5.8428 35.2578L0 29.4141V33.6562L3.722 37.3789C5.400 39.0572 7.676 39.9999 10.0498 40C14.9926 40 19 35.9926 19 31.0498V19C19 18.4477 19.4477 18 20 18C20.5523 18 21 18.4477 21 19V31.0498C21 35.9926 25.0074 40 29.9502 40C32.324 39.9999 34.6 39.0572 36.278 37.3789L40 33.6562V29.4141L34.1572 35.2578C33.042 36.3734 31.528 36.9999 29.9502 37C26.6642 37 24 34.3358 24 31.0498V19C24 16.7909 22.2091 15 20 15Z" fill="#F8FAFC" />
                <path d="M20 5C12.268 5 6 11.268 6 19V25.1719L9 28.1719V19C9 12.9249 13.9249 8 20 8C26.0751 8 31 12.9249 31 19V28.1719L34 25.1719V19C34 11.268 27.732 5 20 5Z" fill="#F8FAFC" />
                <path d="M20 0C9.5066 0 1 8.5066 1 19V20.1719L4 23.1719V19C4 10.1634 11.1634 3 20 3C28.8366 3 36 10.1634 36 19V23.1719L39 20.1719V19C39 8.5066 30.4934 0 20 0Z" fill="#F8FAFC" />
              </svg>
            </div>
            <div className="absolute left-0 top-[122px] w-full text-center">
              <span className="font-inter text-[29px] font-bold leading-none tracking-[-1.5px] text-black">
                One Platform for Every Business and Revenue Decision
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="h-full w-full min-w-0 flex-1 overflow-y-auto rounded-[18px] bg-white">
          <div className="flex h-full min-h-full w-full flex-col items-center px-4 py-6 sm:px-6 lg:px-4">
            <div className="my-auto h-auto w-full max-w-[449px]">

              {/* TOP SECTION */}
              <div className="w-full text-center">
                <div className="mx-auto h-[32px] w-[32px]">
                  <img
                    src="https://ik.imagekit.io/qiap0iq38/DATACIRCLES_PROJECT/signup/Logo.png"
                    alt="logo"
                    className="h-[32px] w-[32px] object-contain"
                  />
                </div>
                <h1 className="mt-[16px] font-['Inter'] text-[26px] font-semibold leading-[32px] tracking-[-0.14px] text-[#0F172A]">
                  Create Your Account
                </h1>
                <p className="mt-[6px] font-['Inter'] text-[15px] font-medium leading-[22px] text-[#475569]">
                  Set up your workspace and start managing your business project workflows.
                </p>
              </div>

              {/* SOCIAL SIGN UP */}
              <div className="mt-[28px] w-full">
                <div className="flex flex-col gap-[12px]">
                  <button
                    type="button"
                    onClick={() => loginWithRedirect({ authorizationParams: { connection: "google-oauth2", screen_hint: "signup" } })}
                    className="flex h-[46px] w-full items-center justify-center gap-[10px] rounded-full border border-[#E2E8F0] bg-white font-['Inter'] text-[14px] font-medium leading-[20px] text-[#0F172A] transition hover:border-[#0085FF]"
                  >
                    <img src="https://ik.imagekit.io/qiap0iq38/DATACIRCLES_PROJECT/signup/Rectangle%2034624569.png" alt="" className="h-[20px] w-[20px]" />
                    Continue with Google
                  </button>

                  <button
                    type="button"
                    onClick={() => loginWithRedirect({ authorizationParams: { connection: "github", screen_hint: "signup" } })}
                    className="flex h-[46px] w-full items-center justify-center gap-[10px] rounded-full border border-[#E2E8F0] bg-white font-['Inter'] text-[14px] font-medium leading-[20px] text-[#0F172A] transition hover:border-[#0085FF]"
                  >
                    <img src="https://ik.imagekit.io/qiap0iq38/DATACIRCLES_PROJECT/signup/Rectangle%2034624566.png" alt="" className="h-[20px] w-[20px]" />
                    Continue with GitHub
                  </button>

                  <button
                    type="button"
                    onClick={() => loginWithRedirect({ authorizationParams: { connection: "facebook", scope: "openid profile email", screen_hint: "signup" } })}
                    className="flex h-[46px] w-full items-center justify-center gap-[10px] rounded-full border border-[#E2E8F0] bg-white font-['Inter'] text-[14px] font-medium leading-[20px] text-[#0F172A] transition hover:border-[#0085FF]"
                  >
                    <img src="https://ik.imagekit.io/qiap0iq38/DATACIRCLES_PROJECT/signup/Rectangle%2034624567.png" alt="" className="h-[20px] w-[20px]" />
                    Continue with Facebook
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="flex h-[46px] w-full items-center justify-center gap-[10px] rounded-full border border-[#E2E8F0] bg-white font-['Inter'] text-[14px] font-medium leading-[20px] text-[#0F172A] transition hover:border-[#0085FF]"
                  >
                    <img src="https://ik.imagekit.io/qiap0iq38/DATACIRCLES_PROJECT/signup/Rectangle%2034624568.png" alt="" className="h-[20px] w-[20px]" />
                    Continue with Phone
                  </button>
                </div>
              </div>

              {/* LOGIN LINK */}
              <div className="mt-[20px] flex justify-center">
                <p className="text-center font-['Inter'] text-[14px] font-normal leading-[20px] text-[#0F172A]">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="ml-[3px] cursor-pointer font-['Inter'] text-[14px] font-semibold leading-[20px] text-[#0085FF]"
                  >
                    Log In
                  </button>
                </p>
              </div>

              {/* FOOTER */}
              <div className="mt-[16px] w-full justify-center">
                <div className="h-px w-full bg-[#E2E8F0]" />
                <div className="mt-[14px] flex w-full flex-wrap items-center justify-center gap-4 sm:gap-8">
                  <span className="font-['Inter'] text-[13px] font-normal leading-[20px] text-[#475569]">
                    2026 Datacircles. All Rights Reserved.
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-[32px]">
                    <button type="button" className="font-['Inter'] text-[13px] font-normal leading-[20px] text-[#475569]">
                      Privacy Policy
                    </button>
                    <button type="button" className="font-['Inter'] text-[13px] font-normal leading-[20px] text-[#475569]">
                      Terms of Service
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
