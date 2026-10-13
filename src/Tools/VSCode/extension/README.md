# Isabelle/VSCode Prover IDE

## General notes

This extension connects an ordinary VS Code or VSCodium installation to
Isabelle/PIDE. Install the VSIX and make the `isabelle` executable available
on `PATH`.

The implementation uses the VS Code Language Server Protocol (LSP) with
Isabelle/PIDE additions. For `.thy`, `.ML`, `.sml`, and `.sig` files, a
file-system provider shows Isabelle symbols as Unicode in the editor and
converts them back to `\<name>` form when saving. The original disk file
remains UTF-8 text with Isabelle symbol escapes. The extension routes
symbolic files opened from the Explorer into this view automatically and
passes ordinary file URIs to the Isabelle language server. Other editors
continue to see the original file content.

Install the Isabelle fonts and select an Isabelle font in VS Code's
`editor.fontFamily` setting for the full mathematical character set.

Isabelle/VSCode works best when opening an Isabelle project directory
as a "workspace", with explorer access to the sources.  Afterwards it
is possible to edit `.thy` and `.ML` files with semantic checking by
the prover in the background, similar to Isabelle/jEdit. There is also
support for other file formats, e.g. `bib` for bibliographic
databases, which may be combined with a regular VSCode extension for
LaTeX/BibTeX.


## Known limitations of Isabelle/VSCode

  * Lack of formal editor perspective in VSCode: only the cursor position is
  used (with some surrounding lines of text).

  * Big theory files may cause problems to the VSCode rendering engine, since
  messages and text decorations are applied to the text as a whole (cf. the
  minimap view).

  * Overall lack of features and refinements compared to Isabelle/jEdit.
