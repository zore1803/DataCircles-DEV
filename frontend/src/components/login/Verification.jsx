
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Verification() {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email || "johndoe@example.com";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [timeLeft, setTimeLeft] = useState(39);

  const inputRefs = useRef([]);

  // ==================================================
  // COUNTDOWN
  // ==================================================

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // ==================================================
  // HANDLE CODE CHANGE
  // ==================================================

  const handleCodeChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);

    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ==================================================
  // HANDLE BACKSPACE
  // ==================================================

  const handleKeyDown = (event, index) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ==================================================
  // HANDLE PASTE
  // ==================================================

  const handlePaste = (event) => {
    event.preventDefault();

    const pastedCode = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pastedCode) return;

    const newCode = ["", "", "", "", "", ""];

    pastedCode.split("").forEach((digit, index) => {
      newCode[index] = digit;
    });

    setCode(newCode);

    const focusIndex = Math.min(pastedCode.length, 5);

    inputRefs.current[focusIndex]?.focus();
  };

  // ==================================================
  // RESEND CODE
  // ==================================================

  const handleResend = () => {
    if (timeLeft > 0) return;

    setCode(["", "", "", "", "", ""]);
    setTimeLeft(39);

    inputRefs.current[0]?.focus();

    // Backend resend functionality will be connected later.
  };

  // ==================================================
  // VERIFY CODE
  // ==================================================

  const handleVerify = () => {
    const enteredCode = code.join("");

    if (enteredCode.length !== 6) {
      return;
    }

    // Frontend only for now.
    // Backend OTP verification will be connected later.

    console.log("Verification code:", enteredCode);

    navigate("/dashboard");
  };

  const isCodeComplete = code.every((digit) => digit !== "");

  const formattedTime = `00:${String(timeLeft).padStart(2, "0")}`;

  return (
    <div className="min-h-screen w-full bg-[#EAEAEA] p-2 font-inter">
      <div className="flex w-full items-start gap-4">

        {/* ==================================================
            LEFT SECTION — SAME AS REGISTER
            HIDDEN ON MOBILE
            ================================================== */}

        <div className="relative hidden h-[905px] w-[599px] shrink-0 overflow-hidden rounded-[18px] bg-white lg:block">

          {/* TOP TRANSPARENT IMAGE */}
          <img
            src="/src/assets/Ellipse 2.png"
            alt=""
            className="absolute left-0 -top-40 z-10 h-auto w-full object-contain"
          />

          {/* BOTTOM TRANSPARENT IMAGE */}
          <img
            src="/src/assets/Ellipse 1.png"
            alt=""
            className="absolute left-0 z-10 h-[120%] w-full object-contain"
          />

          {/* BOTTOM CONTENT */}
          <div className="absolute bottom-[32px] mb-20 left-1/2 z-20 h-[286px] w-[448px] -translate-x-1/2">

            {/* ICON */}
            <div className="absolute left-[178px] top-0 flex h-[92px] w-[92px] items-center justify-center rounded-[16px] bg-[#0085FF]">

              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M20 10C15.0294 10 11 14.0294 11 19V31.0498C11 31.5743 10.5743 32 10.0498 32C9.798 31.9999 9.557 31.8997 9.3789 31.7217L0 22.3428V26.585L7.2578 33.8428C7.9984 34.5834 9.002 34.9999 10.0498 35C12.2312 35 14 33.2312 14 31.0498V19C14 15.6863 16.6863 13 20 13C23.3137 13 26 15.6863 26 19V31.0498C26 33.2312 27.7688 35 29.9502 35C30.998 34.9999 32.0016 34.5834 32.7422 33.8428L34.707 31.8785L37.707 28.8785L40 26.585V22.3428L37.8789 24.4639L35.585 26.7574L32.585 29.7574L30.6211 31.7217C30.443 31.8997 30.202 31.9999 29.9502 32C29.4257 32 29 31.5743 29 31.0498V19C29 14.0294 24.9706 10 20 10ZM20 15C17.7909 15 16 16.7909 16 19V31.0498C16 34.3358 13.3358 37 10.0498 37C8.472 36.9999 6.958 36.3735 5.8428 35.2578L0 29.4141V33.6562L3.722 37.3789C5.4004 39.0572 7.676 39.9999 10.0498 40C14.9926 40 19 35.9926 19 31.0498V19C19 18.4477 19.4477 18 20 18C20.5523 18 21 18.4477 21 19V31.0498C21 35.9926 25.0074 40 29.9502 40C32.324 39.9999 34.6 39.0572 36.278 37.3789L40 33.6562V29.4141L34.1572 35.2578C33.042 36.3734 31.528 36.9999 29.9502 37C26.6642 37 24 34.3358 24 31.0498V19C24 16.7909 22.2091 15 20 15Z"
                  fill="#F8FAFC"
                />

                <path
                  d="M20 5C12.268 5 6 11.268 6 19V25.1719L9 28.1719V19C9 12.9249 13.9249 8 20 8C26.0751 8 31 12.9249 31 19V28.1719L34 25.1719V19C34 11.268 27.732 5 20 5Z"
                  fill="#F8FAFC"
                />

                <path
                  d="M20 0C9.5066 0 1 8.5066 1 19V20.1719L4 23.1719V19C4 10.1634 11.1634 3 20 3C28.8366 3 36 10.1634 36 19V23.1719L39 20.1719V19C39 8.5066 30.4934 0 20 0Z"
                  fill="#F8FAFC"
                />
              </svg>

            </div>

            {/* DATACIRCLES TEXT */}
            <div className="absolute left-0 top-[122px] w-full text-center">
              <span className="font-inter text-[29px] font-bold leading-none tracking-[-1.5px] text-black">
                One Platform for Every Business and Revenue Decision
              </span>
            </div>

          </div>
        </div>

        {/* ==================================================
            RIGHT SECTION — SAME AS REGISTER
            ================================================== */}

        <div className="h-[899px] min-w-0 flex-1 overflow-hidden rounded-[18px] bg-white">

          {/* CENTERED CONTENT */}
          <div className="flex h-full w-full items-center justify-center px-4 sm:px-0">

            {/* ==================================================
                ONLY THIS CENTER CONTENT IS REPLACED
                449 × 692
                ================================================== */}

            <div className="h-[692px] w-full max-w-[449px] shrink-0">

              <div className="relative h-full w-full">

                {/* ==================================================
                    VERIFICATION ICON IMAGE
                    ================================================== */}

                <img
                  src="https://ik.imagekit.io/qiap0iq38/DATACIRCLES_PROJECT/signup/Frame%2026.png"
                  alt="Email verification"
                  className="
                    absolute
                    left-0
                    top-0
                    h-[56px]
                    w-[56px]
                    object-contain
                  "
                />

                {/* ==================================================
                    HEADING
                    ================================================== */}

                <h1
                  className="
                    absolute
                    left-0
                    top-[82px]
                    m-0
                    font-['Inter']
                    text-[28px]
                    font-semibold
                    leading-[36px]
                    tracking-[-0.14px]
                    text-[#0F172A]
                  "
                >
                  Check your Email
                </h1>

                {/* ==================================================
                    DESCRIPTION
                    ================================================== */}

                <p
                  className="
                    absolute
                    left-0
                    top-[132px]
                    m-0
                    font-['Inter']
                    text-[18px]
                    font-medium
                    leading-[28px]
                    text-[#475569]
                  "
                >
                  Enter the unique code we sent to
                </p>

                <p
                  className="
                    absolute
                    left-0
                    top-[160px]
                    m-0
                    max-w-full
                    font-['Inter']
                    text-[18px]
                    font-medium
                    leading-[28px]
                  "
                >
                  <span className="text-[#0085FF]">
                    {email}
                  </span>

                  <span className="text-[#475569]">
                    {" "}below
                  </span>
                </p>

                {/* ==================================================
                    OTP INPUTS
                    ================================================== */}

                <div
                  className="
                    absolute
                    left-0
                    top-[214px]
                    flex
                    w-full
                    justify-between
                    gap-2
                    sm:gap-0
                  "
                  onPaste={handlePaste}
                >
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(event) =>
                        handleCodeChange(
                          event.target.value,
                          index
                        )
                      }
                      onKeyDown={(event) =>
                        handleKeyDown(event, index)
                      }
                      className="
                        h-[48px]
                        w-[calc((100%-40px)/6)]
                        rounded-full
                        border
                        border-[#E2E8F0]
                        bg-white
                        text-center
                        font-['Inter']
                        text-[14px]
                        font-normal
                        leading-[20px]
                        text-[#0F172A]
                        outline-none
                        transition
                        focus:border-[#0085FF]
                        sm:h-[48px]
                        sm:w-[69px]
                      "
                    />
                  ))}
                </div>

                {/* ==================================================
                    DIDN'T RECEIVE
                    ================================================== */}

                <div
                  className="
                    absolute
                    left-0
                    top-[290px]
                    flex
                    w-full
                    items-center
                    justify-center
                  "
                >
                  <span
                    className="
                      font-['Inter']
                      text-[14px]
                      font-semibold
                      leading-[20px]
                      text-[#0F172A]
                    "
                  >
                    Didn't Receive It?
                  </span>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={timeLeft > 0}
                    className={`
                      ml-[8px]
                      font-['Inter']
                      text-[14px]
                      font-semibold
                      leading-[20px]
                      ${
                        timeLeft > 0
                          ? "cursor-not-allowed text-[#94A3B8]"
                          : "cursor-pointer text-[#0085FF]"
                      }
                    `}
                  >
                    Send Again
                  </button>
                </div>

                {/* ==================================================
                    RESEND TIMER
                    ================================================== */}

                <div
                  className="
                    absolute
                    left-0
                    top-[341px]
                    flex
                    w-full
                    items-center
                    justify-center
                  "
                >
                  <span
                    className="
                      font-['Inter']
                      text-[14px]
                      font-semibold
                      leading-[20px]
                      text-[#0F172A]
                    "
                  >
                    Resend
                  </span>

                  <span
                    className="
                      ml-[8px]
                      font-['Inter']
                      text-[14px]
                      font-semibold
                      leading-[20px]
                      text-[#0085FF]
                    "
                  >
                    {formattedTime}
                  </span>
                </div>

                {/* ==================================================
                    VERIFY BUTTON
                    ================================================== */}

                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!isCodeComplete}
                  className="
                    absolute
                    left-0
                    top-[390px]
                    h-[48px]
                    w-full
                    rounded-full
                    bg-[#0085FF]
                    font-['Inter']
                    text-[14px]
                    font-medium
                    leading-[20px]
                    text-white
                    transition
                    hover:bg-[#0078E8]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Verify Code
                </button>

              </div>

              {/* FOOTER */}
              <div className="mt-35 w-full justify-center">

                {/* DIVIDER */}
                <div className="h-px w-[120%] -translate-x-10 bg-[#E2E8F0]" />

                {/* Footer Content */}
                <div className="mt-[20px] flex w-full items-center justify-center gap-8 whitespace-nowrap">

                  <span className="font-['Inter'] text-[14px] font-normal leading-[20px] text-[#475569]">
                    2026 Datacircles. All Rights Reserved.
                  </span>

                  <div className="flex items-center gap-[32px]">

                    <button
                      type="button"
                      className="font-['Inter'] text-[14px] font-normal leading-[20px] text-[#475569]"
                    >
                      Privacy Policy
                    </button>

                    <button
                      type="button"
                      className="font-['Inter'] text-[14px] font-normal leading-[20px] text-[#475569]"
                    >
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



