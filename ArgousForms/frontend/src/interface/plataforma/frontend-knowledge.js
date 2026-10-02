import { Box, Typography } from '@mui/material';
import markdown from '../../../AGENTS.md?raw';

// Render the headings, lists and inline code used by this repository document.
// React escapes all text; the document is never interpreted as HTML.
function inline(text) {
  return text.split(/(`[^`]+`)/g).map((part, index) =>
    part.startsWith('`') && part.endsWith('`') ? (
      <Box
        component="code"
        key={index}
        sx={{
          bgcolor: 'action.hover',
          px: 0.5,
          borderRadius: 0.5,
          fontSize: '0.9em',
          overflowWrap: 'anywhere',
        }}
      >
        {part.slice(1, -1)}
      </Box>
    ) : (
      part
    ),
  );
}

export default function FrontendKnowledge() {
  return (
    <Box
      component="article"
      lang="pt-BR"
      sx={{ mt: 3, lineHeight: 1.8, overflowWrap: 'anywhere' }}
    >
      {markdown
        .trim()
        .split(/\n\s*\n/)
        .map((block, index) => {
          if (block.startsWith('# '))
            return (
              <Typography
                key={index}
                component="h2"
                variant="h5"
                sx={{ mb: 3 }}
              >
                {inline(block.slice(2))}
              </Typography>
            );
          if (block.startsWith('## '))
            return (
              <Typography
                key={index}
                component="h3"
                variant="h6"
                sx={{ mt: 4, mb: 1.5 }}
              >
                {inline(block.slice(3))}
              </Typography>
            );
          if (block.startsWith('- '))
            return (
              <Box
                component="ul"
                key={index}
                sx={{ pl: 3, my: 2, '& li': { mb: 1 } }}
              >
                {block.split('\n').map((line, item) => (
                  <li key={item}>{inline(line.replace(/^- /, ''))}</li>
                ))}
              </Box>
            );
          return (
            <Typography
              key={index}
              component="p"
              sx={{ mb: 2, lineHeight: 1.8 }}
            >
              {inline(block)}
            </Typography>
          );
        })}
    </Box>
  );
}
