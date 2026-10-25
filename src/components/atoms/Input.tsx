import { FaRegCheckCircle } from "react-icons/fa";
import { RxCrossCircled } from "react-icons/rx";
import { type InputProps } from "../../types/components.types";

const Input = ({
  id,
  label,
  title,
  type = "text",
  accept,
  value,
  onChange,
  inputValid,
  errorMsg,
  placeholder,
  required = false,
  disabled = false,
  maxLength,
  className,
}: InputProps) => {
  const hasValue = value?.trim().length !== 0;

  return (
    <div className={`flex flex-col ${errorMsg && hasValue ? "-mb-1.5" : "mb-3"}`}>
      <label
        htmlFor={id}
        className={`${className ? className : "text-[var(--text1)]"} text-lg font-semibold md:text-2xl my-1 `}
      >
        {label}
        {/* {required && <span className="ml-1">*</span>} */}
      </label>
      <div className="relative flex items-center -mt-0.5">
        <input
          id={id}
          title={title}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          accept={accept}
          maxLength={maxLength}
          // aria-invalid={!inputValid}
          className={`bg-[var(--bg)] text-[var(--text1)] font-semibold rounded-full w-full text-lg md:text-xl px-3 py-0.5 pr-13
            outline-none border
            placeholder:text-[0.9rem]
            md:placeholder:text-[1rem]
            ${inputValid === false && hasValue ? "border-[var(--error)]" : "border-transparent"}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${className?.includes("text-[var(--text2)]") ? `${className} text-[var(--text1)]!` : className}
          `}
        />

        {inputValid === true && hasValue ? (
          <FaRegCheckCircle size={22} className="absolute right-2 text-[var(--success)]" aria-hidden />
        ) : null}
        {inputValid === false && hasValue ? (
          <RxCrossCircled size={22} className="absolute right-2 text-[var(--error)]" aria-hidden />
        ) : null}
      </div>
      {errorMsg && hasValue ? (
        <p className="text-[0.9rem] text-[var(--error)] mb-2" role="alert">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
};

export default Input;
