

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildFallbackOutput(mode: any, data: Record<string, any>) {
  switch (mode) {
    case "blog": {
      const topic = data.topic || "Professional Content";
      return {
        title: `${topic} Guide`,
        slug: slugify(topic),
        excerpt: `A practical, production-ready guide about ${topic}.`,
        outline: [
          `Introduction to ${topic}`,
          "Core ideas",
          "Best practices",
          "Action plan",
        ],
        full_content: `# ${topic} Guide\n\nWrite a high-quality blog draft here based on the provided data.`,
        seo_tags: [slugify(topic), "guide", "how-to"],
        call_to_action: "Read more and apply these ideas in your workflow.",
      };
    }

    case "template": {
      const name = data.template_type || "Template";
      return {
        template_name: `${name} Template`,
        slug: slugify(name),
        description: `A reusable template for ${name.toLowerCase()}.`,
        tags: ["template", "reusable", slugify(name)],
        sections: [
          {
            section_name: "Header",
            purpose: "Introduce the template",
            fields: ["title", "subtitle"],
          },
          {
            section_name: "Body",
            purpose: "Main content area",
            fields: ["content"],
          },
        ],
        sample_content: {
          title: `${name} Example`,
          subtitle: "Sample subtitle",
          body: "Sample body content generated as fallback.",
        },
      };
    }

    case "resume": {
      const role = data.target_role || "Frontend Developer";
      return {
        headline: `${role} | Clean UI, Scalable Systems`,
        professional_summary: `Motivated ${role} with practical experience and strong ownership mindset.`,
        skills_section: ["JavaScript", "React", "TypeScript", "Problem Solving"],
        experience_bullets: [
          "Built responsive web features with reusable components.",
          "Improved UI consistency and maintainability across projects.",
        ],
        project_bullets: [
          "Developed a portfolio-grade application with modern architecture.",
          "Created a modular system for scalable feature delivery.",
        ],
        ats_keywords: [role, "frontend", "responsive design", "typescript"],
        fill_missing_suggestions: [
          "Add years of experience",
          "Add measurable impact numbers",
          "Add 1–2 highlighted projects",
        ],
      };
    }

    case "review": {
      const draft = data.user_draft || "Great service and smooth experience.";
      return {
        polished_message: draft,
        short_version: draft,
        formal_version: draft,
        tone: data.tone || "neutral",
      };
    }

    case "search": {
      const keyword = String(data.keyword || "").trim();
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const results = candidates.slice(0, 6).map((item: any, index: number) => ({
        slug: item.slug || `item-${index + 1}`,
        title: item.title || `Item ${index + 1}`,
        matched_tags: item.tags || [],
        score: Math.max(100 - index * 10, 10),
        reason: "Fallback relevance ranking.",
      }));
      return {
        query_normalized: keyword,
        results,
      };
    }

    case "chat":
    default:
      return {
        answer: "I can help with blog content, template creation, resume generation, review polishing, and template search.",
        next_action: "Ask me to generate content or search templates.",
        quick_replies: [
          "Generate a blog",
          "Create a template",
          "Build my resume",
        ],
      };
  }
}