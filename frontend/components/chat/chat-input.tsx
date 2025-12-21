import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { PromptTextarea } from "./prompt-textarea";

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
}

export function ChatInput({
	onSend,
	disabled = false,
	placeholder = "Type a message...",
	className,
}: ChatInputProps) {
	const [value, setValue] = React.useState("");
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	const handleSubmit = () => {
		if (value.trim() && !disabled) {
			onSend(value.trim());
			setValue("");
			textareaRef.current?.focus();
		}
	};

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const activeElement = document.activeElement;
			const isInputFocused =
				activeElement instanceof HTMLInputElement ||
				activeElement instanceof HTMLTextAreaElement ||
				activeElement?.getAttribute("contenteditable") === "true";

			if (
				isInputFocused ||
				e.metaKey ||
				e.ctrlKey ||
				e.altKey ||
				e.key === "Tab" ||
				e.key === "Escape"
			) {
				return;
			}

			if (e.key.length === 1) {
				textareaRef.current?.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const showButton = value.trim().length > 0;

	return (
		<div
			onClick={() => textareaRef.current?.focus()}
			className={cn(
				"relative flex items-end p-3 rounded-2xl cursor-text",
				"bg-card backdrop-blur-xl",
				"border border-border",
				"ring-1 ring-black/5 dark:ring-white/5",
				className,
			)}
		>
			<PromptTextarea
				ref={textareaRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onSubmit={handleSubmit}
				placeholder={placeholder}
				disabled={disabled}
				autoFocus
				className="min-h-[24px] py-1 px-1 pr-12"
			/>
			<AnimatePresence>
				{showButton && (
					<motion.button
						type="button"
						onClick={handleSubmit}
						disabled={disabled}
						aria-label="Send message"
						initial={{ opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.5 }}
						transition={{ type: "spring", stiffness: 500, damping: 30 }}
						className="absolute right-3 bottom-3 size-8 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white border-none flex items-center justify-center disabled:opacity-50 cursor-pointer"
					>
						<ArrowUp className="size-4" />
					</motion.button>
				)}
			</AnimatePresence>
		</div>
	);
}
