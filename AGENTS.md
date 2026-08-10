# Agents

This repository is built as part of the LivePark MVP implementation. When modifying or extending the code in this repository, please adhere to the following principles:

1. **Verify State Continuously:** Every significant action that modifies the codebase or infrastructure should be followed by a verification step (e.g., `read_file`, `ls`) to ensure it behaved as expected.
2. **Follow Specifications:** Read the specifications (`LivePark__Comprehensive_Technical_Specification.md`, `Product_Requirements_Document_(PRD)__LivePark_MVP.md`, etc.) in the repository to make informed decisions about product and technical features.
3. **Run Pre-Commit Checks:** Ensure your work is formatted, linted, and verified by calling the `pre_commit_instructions` tool and executing its tasks before finalizing any major set of changes.
4. **Update Progress:** As stages of work are completed, update `PROGRESS.md` so the current state of the project is accurately reflected.