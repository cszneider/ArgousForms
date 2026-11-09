package br.com.argousForms.infraestrutura;

import java.io.IOException;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public final class EntradaArgousFormsServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		response.setHeader( "Cache-Control", "no-store" );
		response.sendRedirect( response.encodeRedirectURL( request.getContextPath() + "/login" ) );
	}
}
