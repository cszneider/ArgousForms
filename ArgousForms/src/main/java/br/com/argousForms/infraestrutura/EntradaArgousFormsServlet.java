package br.com.argousForms.infraestrutura;

import java.io.IOException;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public final class EntradaArgousFormsServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		response.setHeader( "Cache-Control", "no-store" );
		response.sendRedirect( response.encodeRedirectURL( request.getContextPath() + "/login" ) );
	}
}
