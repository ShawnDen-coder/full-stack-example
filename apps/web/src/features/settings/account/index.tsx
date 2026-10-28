import { ContentSection } from "../components/content-section";
import { AccountForm } from "./account-form";

export function SettingsAccount() {
	return (
		<ContentSection
			title="Account"
			desc="Update your account settings. Set your preferred language and
          timezone. Demo form; changes are not saved."
		>
			<AccountForm />
		</ContentSection>
	);
}
