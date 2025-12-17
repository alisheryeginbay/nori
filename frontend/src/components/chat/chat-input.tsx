import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { Button } from "@/components/ui/button";
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
	const [isSending, setIsSending] = React.useState(false);
	const textareaRef = React.useRef<HTMLInputElement>(null);

	const handleSubmit = () => {
		if (value.trim() && !disabled) {
			setIsSending(true);
			onSend(value.trim());
			setValue("");
			textareaRef.current?.focus();
			// Reset after a short delay
			setTimeout(() => setIsSending(false), 100);
		}
	};

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				document.activeElement === textareaRef.current ||
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

	const showButton = value.trim().length > 0 && !isSending;

	const springTransition = { type: "spring", stiffness: 500, damping: 30 } as const;

	return (
		<motion.div layout layoutRoot className={cn("flex items-end gap-3", className)}>
			<motion.div
				layout
				transition={springTransition}
				onClick={() => textareaRef.current?.focus()}
				className={cn(
					"flex-1 flex items-end p-3 rounded-2xl cursor-text",
					"bg-card backdrop-blur-xl",
					"border border-border",
					"ring-1 ring-black/5 dark:ring-white/5",
				)}
			>
				<motion.div layout="position" className="flex-1 flex">
					<PromptTextarea
						ref={textareaRef}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						onSubmit={handleSubmit}
						placeholder={placeholder}
						disabled={disabled}
						autoFocus
						className="h-[24px] py-1 px-1"
					/>
				</motion.div>
			</motion.div>
			<AnimatePresence mode="popLayout">
				{showButton && (
					<motion.button
						layout
						type="button"
						onClick={handleSubmit}
						disabled={disabled}
						aria-label="Send message"
						initial={{ opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.5 }}
						transition={springTransition}
						className="size-[48px] rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white border-none flex items-center justify-center disabled:opacity-50"
					>
						<ArrowUp className="size-5" />
					</motion.button>
				)}
			</AnimatePresence>
		</motion.div>
	);
}
