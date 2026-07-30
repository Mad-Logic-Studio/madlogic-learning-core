# Initial domain glossary

These definitions establish the preliminary public vocabulary. They are not a final database schema.

- **Learner:** a durable person or participant record identified by an opaque ID.
- **Course:** reusable learning content independent of scheduling or cohort delivery.
- **CourseRun:** a scheduled or configured delivery of a Course using live, evergreen, or cohort mode.
- **Lesson:** an ordered learning unit belonging to a Course.
- **Enrollment:** durable evidence that a Learner has access to a CourseRun, including append-only status history.
- **AccessLink:** a disposable, expiring, revocable capability linked to an Enrollment; raw token values are never represented in the public model.
- **LessonProgress:** the current progress evidence for one Enrollment and Lesson.
- **LearningEvent:** an immutable vocabulary entry describing a meaningful learning-system occurrence.
- **Tier:** an extensible consumer-defined string attached to Enrollment; the public core defines no brand-specific tier constants.
