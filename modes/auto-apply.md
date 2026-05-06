# Mode: auto-apply — Automated Application Filler

Agentic mode that uses Playwright to automatically navigate to a job application form and fill out all fields (personal info, resume, custom questions) based on the candidate's profile and evaluation reports.

## Requirements

- **Playwright is REQUIRED**: This mode must run in a browser environment to interact with the form.
- **Human-in-the-Loop**: The agent fills everything but **STOPS before the final submit button**.

## Workflow

```text
1. NAVIGATE   → Go to the provided job application URL
2. DETECT     → Identify all form fields (inputs, dropdowns, uploads)
3. MAP        → Match fields with cv.md, profile.yml, and reports/
4. GENERATE   → Create personalized answers for custom/open questions
5. FILL       → Execute Playwright actions to input data and upload CV
6. NOTIFY     → Inform the user that the form is ready for review
```

## Step 1 — Navigation and Detection

1. Navigate to the URL provided in the command.
2. Wait for the page to load completely.
3. Scan the DOM for:
   - Personal information fields (Name, Email, Phone, LinkedIn, GitHub, etc.)
   - Resume/CV upload inputs.
   - Education and Experience sections.
   - Custom questions (textareas or text inputs).
   - Dropdowns (Work authorization, Gender, Race, Veteran status, etc.).

## Step 2 — Data Mapping

1. **Personal Info**: Map from `config/profile.yml`.
2. **Resume**: Locate the most recent tailored CV PDF in `output/` for this company/role. If not found, use `cv.md` as context to explain why a generic one is being used.
3. **Custom Questions**: 
   - Search `reports/` for a matching evaluation report.
   - Use "Block F" (STAR stories) and "Section G" (Draft answers) to generate the response.
   - If no report exists, run a silent "quick evaluation" of the page content to generate context-aware answers.

## Step 3 — Execution (The "Auto" part)

1. **Input Text**: Fill in all standard and custom text fields.
2. **Select Options**: Handle dropdowns by matching the user's preferences in `profile.yml` or standard "Decline to self-identify" options.
3. **Upload Files**: Trigger the file upload for the CV.
4. **Validation**: Check if any "Required" fields are still empty.

## Step 4 — Safety Stop

**CRITICAL RULE: NEVER click the "Submit", "Apply", or "Send Application" button.**

Once filling is complete:
1. Take a screenshot of the filled form.
2. Present a summary to the user:
   > "I've filled out the application for [Role] at [Company]. 
   > - All required fields are filled.
   > - Tailored CV uploaded: [Filename]
   > - Custom answers generated based on your [STAR stories/Report].
   > 
   > Please review the browser window and click **Submit** manually when you're ready."

## Error Handling

- If a field is ambiguous: Stop and ask the user for clarification.
- If a CAPTCHA is detected: Notify the user to solve it manually.
- If the page structure is unsupported: Fall back to `/career-ops apply` (interactive mode).
