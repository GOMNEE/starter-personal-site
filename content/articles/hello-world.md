---
# Every field is named as in Gomnee's Article document:
# https://gomnee.com/schemas/gomnee-article-v2.json
title: "Hello, world: how this blog works"
summary: "A placeholder article that shows every part an article can have. Replace it with your first real one, or delete it."
published: "2026-11-24"
# updated: "2026-12-01"
authors:
  - name: "Your Name"
    url: "https://example.com/about"
    description: "Write one sentence about yourself, as readers should see it under your articles."
# reviewer:
#   name: "Someone who checked it"
categories: ["Notes"]
tags: ["Getting started"]
# search:
#   title: "A different title for search results"
#   description: "A meta description of up to about 160 characters."
# cover:
#   src: "/images/hello-world.jpg"
#   alt: "What the image shows"
#   width: 1200
#   height: 630
# verification:
#   mode: "first_hand" # or "docs_only"
#   lastVerified: "2026-11-24"
#   note: "How you checked what this article says."
faq:
  - question: "Where do articles live?"
    answer: "In `content/articles/`, one Markdown file each. The file name is the article's address."
  - question: "Can I change an article after publishing it?"
    answer: "Yes. Edit it and set `updated`. Never rename the file: its address must stay the same."
sources:
  - label: "Markdown in five minutes (CommonMark)"
    url: "https://commonmark.org/help/"
  - label: "BlogPosting (Schema.org)"
    url: "https://schema.org/BlogPosting"
---

Every article is a Markdown file in `content/articles/`. Its file name is its
address: this file is `hello-world.md`, so it lives at `/blog/hello-world`.

## The front matter

The lines between the two `---` at the top describe the article. Only `title`,
`summary`, `published` and `authors` are required. The rest appear on the page
only when you fill them in: a reviewer, a cover image, categories and tags,
questions, sources, and a note on how you checked what you wrote.

## The body

The page shows the title as its main heading, so the body starts at level two.
Each level-two heading becomes an entry in the article's contents once there
are three of them.

| You write | Readers see    |
| --------- | -------------- |
| Markdown  | A clean page   |
| Dates     | The same dates in search results |

## What happens to HTML

Raw HTML in an article is dropped rather than shown, so a stray tag can never
break the page.
