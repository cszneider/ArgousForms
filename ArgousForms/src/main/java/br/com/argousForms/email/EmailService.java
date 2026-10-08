package br.com.argousForms.email;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Properties;

import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.AddressException;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

/** Envio SMTP da instalação. Não expõe uma operação pública de envio arbitrário. */
public final class EmailService {

	public void enviarConfirmacao( String destinatario, String codigo ) throws EmailException {

		if( codigo == null || !codigo.matches( "[0-9]{8}" ) ) {
			throw new EmailException( "O código de confirmação deve conter oito dígitos." );
		}

		String codigoApresentado = codigo.substring( 0, 4 ) + "-" + codigo.substring( 4 );
		String texto = "Seu código de confirmação do ArgousForms é: " + codigoApresentado
			+ "\n\nDigite esse código na página de cadastro. Ele é válido por 10 minutos."
			+ "\nSe você não solicitou este cadastro, ignore esta mensagem.";
		enviar( destinatario, "Confirme seu e-mail no ArgousForms", texto );
	}

	private void enviar(String destinatario, String assunto, String texto) throws EmailException {
		InternetAddress para = validarEndereco(destinatario);
		EmailConfiguracao configuracao = EmailConfiguracao.carregar();
		InternetAddress de = validarEndereco(configuracao.getConta());
		Session sessao = Session.getInstance(propriedades(configuracao));
		sessao.setDebug(false);

		try {
			MimeMessage mensagem = new MimeMessage(sessao);
			mensagem.setFrom(de);
			mensagem.setRecipient(Message.RecipientType.TO, para);
			mensagem.setSubject(assunto, StandardCharsets.UTF_8.name());
			mensagem.setText(texto, StandardCharsets.UTF_8.name());
			mensagem.setSentDate(new Date());
			mensagem.saveChanges();

			try (Transport transporte = sessao.getTransport("smtp")) {
				transporte.connect(configuracao.getHost(), configuracao.getPorta(), configuracao.getConta(), configuracao.getSenha());
				transporte.sendMessage(mensagem, mensagem.getAllRecipients());
			}
		} catch (MessagingException e) {
			// Não propagar a resposta SMTP: ela pode conter destinatário e detalhes da instalação.
			throw new EmailException("Não foi possível concluir o envio do e-mail de confirmação.");
		}
	}

	static Properties propriedades(EmailConfiguracao configuracao) {
		Properties propriedades = new Properties();
		propriedades.setProperty("mail.smtp.host", configuracao.getHost());
		propriedades.setProperty("mail.smtp.port", Integer.toString(configuracao.getPorta()));
		propriedades.setProperty("mail.smtp.auth", "true");
		propriedades.setProperty("mail.smtp.ssl.checkserveridentity", "true");
		propriedades.setProperty("mail.smtp.connectiontimeout", "10000");
		propriedades.setProperty("mail.smtp.timeout", "10000");
		propriedades.setProperty("mail.smtp.writetimeout", "10000");

		// Porta 465 usa TLS direto; nas demais portas, STARTTLS é obrigatório.
		boolean tlsDireto = configuracao.getPorta() == 465;
		propriedades.setProperty("mail.smtp.ssl.enable", Boolean.toString(tlsDireto));
		propriedades.setProperty("mail.smtp.starttls.enable", Boolean.toString(!tlsDireto));
		propriedades.setProperty("mail.smtp.starttls.required", Boolean.toString(!tlsDireto));
		return propriedades;
	}

	static InternetAddress validarEndereco(String endereco) throws EmailException {
		if (endereco == null || endereco.isBlank() || endereco.indexOf('\r') >= 0 || endereco.indexOf('\n') >= 0) {
			throw new EmailException("Informe um endereço de e-mail válido.");
		}

		try {
			InternetAddress[] enderecos = InternetAddress.parse(endereco.strip(), true);
			if (enderecos.length != 1 || enderecos[0].isGroup() || enderecos[0].getPersonal() != null) {
				throw new AddressException();
			}
			enderecos[0].validate();
			return enderecos[0];
		} catch (AddressException e) {
			throw new EmailException("Informe um único endereço de e-mail válido, sem nome de apresentação.");
		}
	}
}
