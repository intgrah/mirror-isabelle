/*  Title:      Tools/VSCode/src/vscode_main.scala
    Author:     Makarius

VSCode Language Server entry point.
*/

package isabelle.vscode

import isabelle._

import java.io.{PrintStream, OutputStream}

import scala.collection.mutable


object VSCode_Main {
  def extension_dir: Path = Path.explode("$ISABELLE_VSCODE_HOME/extension")
  val MANIFEST: Path = Path.explode("MANIFEST")

  /* Isabelle tool wrapper */

  val isabelle_tool2 =
    Isabelle_Tool("vscode_server", "VSCode Language Server for PIDE", Scala_Project.here,
      { args =>
        try {
          var logic_ancestor: Option[String] = None
          var log_path: Option[Path] = None
          var logic_requirements = false
          val dirs = new mutable.ListBuffer[Path]
          val include_sessions = new mutable.ListBuffer[String]
          var logic = Isabelle_System.default_logic()
          var modes: List[String] = Nil
          var no_build = false
          var options = Options.init()
          var verbose = false

          val getopts = Getopts("""
Usage: isabelle vscode_server [OPTIONS]

  Options are:
    -A NAME      ancestor session for option -R (default: parent)
    -L FILE      logging on FILE
    -R NAME      build image with requirements from other sessions
    -d DIR       include session directory
    -i NAME      include session in name-space of theories
    -l NAME      logic session name (default ISABELLE_LOGIC=""" +
            quote(Isabelle_System.default_logic()) + """)
    -m MODE      add print mode for output
    -n           no build of session image on startup
    -o OPTION    override Isabelle system OPTION (via NAME=VAL or NAME)
    -v           verbose logging

  Run the VSCode Language Server protocol (JSON RPC) over stdin/stdout.
""",
            "A:" -> (arg => logic_ancestor = Some(arg)),
            "L:" -> (arg => log_path = Some(Path.explode(File.standard_path(arg)))),
            "R:" -> (arg => { logic = arg; logic_requirements = true }),
            "d:" -> (arg => dirs += Path.explode(File.standard_path(arg))),
            "i:" -> (arg => include_sessions += arg),
            "l:" -> (arg => logic = arg),
            "m:" -> (arg => modes = arg :: modes),
            "n" -> (_ => no_build = true),
            "o:" -> (arg => options = options + arg),
            "v" -> (_ => verbose = true))

          val more_args = getopts(args)
          if (more_args.nonEmpty) getopts.usage()

          val log_file = Logger.make_file(log_path)
          val channel =
            new Channel(System.in.nn, System.out.nn, log_file, verbose = verbose)
          val server =
            new Language_Server(channel, options, session_name = logic, session_dirs = dirs.toList,
              include_sessions = include_sessions.toList, session_ancestor = logic_ancestor,
              session_requirements = logic_requirements, session_no_build = no_build,
              modes = modes)

          // prevent spurious garbage on the main protocol channel
          val orig_out = System.out
          try {
            System.setOut(new PrintStream(OutputStream.nullOutputStream()))
            server.start()
          }
          finally { System.setOut(orig_out) }
        }
        catch {
          case exn: Throwable =>
            val channel = new Channel(System.in.nn, System.out.nn, Logger.none)
            channel.error_message(Exn.message(exn))
            throw exn
        }
      })
}
